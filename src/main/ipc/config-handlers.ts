import { randomUUID } from 'node:crypto';
import { BrowserWindow, dialog } from 'electron';
import { z } from 'zod';
import { IPC } from '@ipc/ipc-channels';
import type { IpcResponse, ServerConfig, AppPreferences } from '@shared/types';
import { writeFileAtomic } from '../store/atomic-write';
import { configStore } from '../store/config-store';
import { ConfigStoreError } from '../store/config-store-error';
import { t, setLanguage } from '../i18n/main-i18n';
import { connectionManager } from '../rpc/connection-manager';
import { toIpcError } from '../rpc/to-ipc-error';
import { resolveTestServer, toPublicServer, withoutSecrets, withSecrets } from '../security/server-credentials';
import { approvedPaths, ApprovedPathError } from '../security/approved-paths';
import { handleGuarded, type SenderValidator } from '../security/ipc-guard';
import {
  exportOptionsSchema,
  importDataSchema,
  importRequestSchema,
  newServerSchema,
  prefsPatchSchema,
  serverIdSchema,
  serverUpdateSchema,
  testServerSchema,
} from '../security/schemas';

const MAX_IMPORT_BYTES = 5_000_000;

type ImportData = z.infer<typeof importDataSchema>;

/** Resolves an import request to validated backup data: reads the file when it is a `{ filePath }` request. */
export function resolveImportData(request: z.infer<typeof importRequestSchema>): ImportData {
  return 'filePath' in request ? readImportFile(request.filePath) : request;
}

/** Loads backup data from a dialog-approved JSON file and validates it. */
function readImportFile(filePath: string): ImportData {
  const raw = approvedPaths.read(filePath, { kind: 'json', extensions: ['.json'], maxBytes: MAX_IMPORT_BYTES });
  return importDataSchema.parse(JSON.parse(raw.toString('utf-8')));
}

/**
 * `watchFolder` is read from disk by the watcher, so the renderer may only set it to a folder the user
 * picked in a native dialog (or leave the stored value). Returns false when the patch must be rejected.
 */
export function isWatchFolderAllowed(candidate: string | undefined): boolean {
  if (!candidate) return true;
  if (candidate === configStore.getPreferences().watchFolder) return true;
  return approvedPaths.isApproved(candidate, 'watch-folder');
}

/** Applies validated backup data: new servers (duplicates skipped) and preferences without `watchFolder`. */
export async function applyImport(data: ImportData): Promise<IpcResponse> {
  let serversAdded = 0;
  let serversSkipped = 0;
  let prefsImported = false;

  if (data.servers) {
    const existing = configStore.getServers();
    for (const server of data.servers) {
      const duplicate = existing.find(
        (e) => e.host === server.host && e.port === server.port && e.path === server.path,
      );
      if (duplicate) {
        serversSkipped++;
      } else {
        const newServer: ServerConfig = { ...server, id: randomUUID() };
        await configStore.addServer(newServer);
        existing.push(newServer);
        serversAdded++;
      }
    }
  }

  if (data.preferences) {
    // A backup must not be able to point the watcher at an arbitrary folder.
    const { watchFolder: _ignored, ...safePrefs } = data.preferences;
    await configStore.updatePreferences(safePrefs);
    if (safePrefs.language !== undefined) setLanguage(safePrefs.language);
    prefsImported = true;
  }

  return { success: true, data: { serversAdded, serversSkipped, prefsImported } };
}

/** Native confirmation before a backup with clear-text passwords is handed to the renderer (default: cancel). */
async function confirmPasswordExport(window: BrowserWindow | null): Promise<boolean> {
  const options: Electron.MessageBoxOptions = {
    type: 'warning',
    buttons: [t('native.exportSecrets.cancel'), t('native.exportSecrets.allow')],
    defaultId: 0,
    cancelId: 0,
    noLink: true,
    title: t('native.exportSecrets.title'),
    message: t('native.exportSecrets.message'),
  };
  const result = window ? await dialog.showMessageBox(window, options) : await dialog.showMessageBox(options);
  return result.response === 1;
}

/** Registers server, preference and backup import/export channels. */
export function registerConfigHandlers(isTrusted: SenderValidator): void {
  const none = z.tuple([]);

  handleGuarded(isTrusted, IPC.SERVER_LIST, none, (): IpcResponse<ServerConfig[]> => {
    return { success: true, data: configStore.getServers().map(toPublicServer) };
  });

  handleGuarded(isTrusted, IPC.CONFIG_SECRET_STORAGE, none, (): IpcResponse<boolean> => ({
    success: true,
    data: configStore.isSecretStorageEncrypted(),
  }));

  handleGuarded(
    isTrusted,
    IPC.SERVER_ADD,
    z.tuple([newServerSchema]),
    async (_e, [config]): Promise<IpcResponse<ServerConfig>> => {
      const server: ServerConfig = { ...config, id: randomUUID() };
      await configStore.addServer(server);
      return { success: true, data: toPublicServer(server) };
    },
  );

  handleGuarded(
    isTrusted,
    IPC.SERVER_UPDATE,
    z.tuple([serverIdSchema, serverUpdateSchema]),
    async (_e, [id, updates]): Promise<IpcResponse> => {
      await configStore.updateServer(id, updates);
      const updated = configStore.getServers().find((s) => s.id === id);
      if (updated) connectionManager.refreshClient(updated);
      return { success: true };
    },
  );

  handleGuarded(isTrusted, IPC.SERVER_REMOVE, z.tuple([serverIdSchema]), async (_e, [id]): Promise<IpcResponse> => {
    await configStore.removeServer(id);
    connectionManager.removeClient(id);
    return { success: true };
  });

  handleGuarded(
    isTrusted,
    IPC.SERVER_SET_ACTIVE,
    z.tuple([serverIdSchema.nullable()]),
    async (_e, [id]): Promise<IpcResponse> => {
      // The store and the connection manager must agree: an unknown id is refused, null disconnects.
      const server = id === null ? undefined : configStore.getServers().find((s) => s.id === id);
      if (id !== null && !server) return { success: false, error: 'Invalid request' };
      await configStore.setActiveServerId(id);
      if (server) connectionManager.setActiveServer(server);
      else connectionManager.clearActive();
      return { success: true };
    },
  );

  handleGuarded(isTrusted, IPC.SERVER_TEST, z.tuple([testServerSchema]), async (_e, [config]): Promise<IpcResponse> => {
    try {
      const stored = config.id ? configStore.getServers().find((s) => s.id === config.id) : undefined;
      const client = connectionManager.createTemporaryClient(resolveTestServer(config, stored));
      await client.request('session-get');
      return { success: true };
    } catch (err) {
      return toIpcError(err);
    }
  });

  handleGuarded(isTrusted, IPC.PREFS_GET, none, (): IpcResponse<AppPreferences> => {
    return { success: true, data: configStore.getPreferences() };
  });

  handleGuarded(isTrusted, IPC.PREFS_SET, z.tuple([prefsPatchSchema]), async (_e, [prefs]): Promise<IpcResponse> => {
    if (!isWatchFolderAllowed(prefs.watchFolder)) {
      return {
        success: false,
        error: 'Watch folder must be chosen with the folder dialog',
        code: 'WATCH_FOLDER_NOT_APPROVED',
      };
    }
    await configStore.updatePreferences(prefs);
    if (prefs.language !== undefined) setLanguage(prefs.language);
    return { success: true };
  });

  handleGuarded(
    isTrusted,
    IPC.CONFIG_EXPORT,
    z.tuple([exportOptionsSchema]),
    async (event, [options]): Promise<IpcResponse> => {
      // Passwords leave main only after the user approves it in a native dialog the renderer cannot answer.
      const includePasswords = options.includePasswords === true;
      if (includePasswords && !(await confirmPasswordExport(BrowserWindow.fromWebContents(event.sender)))) {
        return { success: false, error: t('native.exportSecrets.declined'), code: 'CANCELLED' };
      }
      const result: Record<string, unknown> = { version: 1, exportedAt: new Date().toISOString() };
      if (options.servers !== false) {
        const allServers = configStore.getServers();
        const wanted = options.serverIds;
        const selected = wanted ? allServers.filter((s) => wanted.includes(s.id)) : allServers;
        result.servers = selected.map(includePasswords ? withSecrets : withoutSecrets);
      }
      if (options.preferences) {
        result.preferences = configStore.getPreferences();
      }
      if (!includePasswords) return { success: true, data: result };

      // Secrets never cross IPC: main picks the destination itself and writes the file.
      const window = BrowserWindow.fromWebContents(event.sender);
      const saveOptions: Electron.SaveDialogOptions = {
        defaultPath: 'seedora-config.json',
        filters: [{ name: 'JSON', extensions: ['json'] }],
      };
      const picked = window
        ? await dialog.showSaveDialog(window, saveOptions)
        : await dialog.showSaveDialog(saveOptions);
      if (picked.canceled || !picked.filePath)
        return { success: false, error: t('native.exportSecrets.declined'), code: 'CANCELLED' };
      try {
        writeFileAtomic(picked.filePath, JSON.stringify(result, null, 2));
      } catch (err) {
        console.error('[Export] Write failed:', err instanceof Error ? err.name : 'unknown error');
        return { success: false, error: 'Export failed', code: 'EXPORT_FAILED' };
      }
      return { success: true };
    },
  );

  // Data is either the parsed JSON itself or { filePath } of a dialog-approved file.
  handleGuarded(
    isTrusted,
    IPC.CONFIG_IMPORT,
    z.tuple([importRequestSchema]),
    async (_e, [request]): Promise<IpcResponse> => {
      try {
        return await applyImport(resolveImportData(request));
      } catch (err) {
        console.error('[Import] Failed:', err instanceof Error ? err.name : 'unknown error');
        const reason = err instanceof ApprovedPathError ? err.message : 'invalid file';
        const code = err instanceof ConfigStoreError ? err.code : 'IMPORT_INVALID';
        return { success: false, error: `Import failed: ${reason}`, code };
      }
    },
  );
}
