import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { IPC } from '@shared/ipc-channels';
import type { IpcResponse, ServerConfig, AppPreferences } from '@shared/types';
import { configStore } from '../store/config-store';
import { connectionManager } from '../rpc/connection-manager';
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
export function applyImport(data: ImportData): IpcResponse {
  let serversAdded = 0;
  let serversSkipped = 0;
  let prefsImported = false;

  if (data.servers) {
    const existing = configStore.getServers();
    for (const server of data.servers) {
      const duplicate = existing.find(e => e.host === server.host && e.port === server.port && e.path === server.path);
      if (duplicate) {
        serversSkipped++;
      } else {
        const newServer: ServerConfig = { ...server, id: randomUUID() };
        configStore.addServer(newServer);
        existing.push(newServer);
        serversAdded++;
      }
    }
  }

  if (data.preferences) {
    // A backup must not be able to point the watcher at an arbitrary folder.
    const { watchFolder: _ignored, ...safePrefs } = data.preferences;
    configStore.updatePreferences(safePrefs);
    prefsImported = true;
  }

  return { success: true, data: { serversAdded, serversSkipped, prefsImported } };
}

/** Registers server, preference and backup import/export channels. */
export function registerConfigHandlers(isTrusted: SenderValidator): void {
  const none = z.tuple([]);

  handleGuarded(isTrusted, IPC.SERVER_LIST, none, (): IpcResponse<ServerConfig[]> => {
    return { success: true, data: configStore.getServers() };
  });

  handleGuarded(isTrusted, IPC.SERVER_ADD, z.tuple([newServerSchema]), (_e, [config]): IpcResponse<ServerConfig> => {
    const server: ServerConfig = { ...config, id: randomUUID() };
    configStore.addServer(server);
    return { success: true, data: server };
  });

  handleGuarded(isTrusted, IPC.SERVER_UPDATE, z.tuple([serverIdSchema, serverUpdateSchema]), (_e, [id, updates]): IpcResponse => {
    configStore.updateServer(id, updates);
    const updated = configStore.getServers().find(s => s.id === id);
    if (updated) connectionManager.refreshClient(updated);
    return { success: true };
  });

  handleGuarded(isTrusted, IPC.SERVER_REMOVE, z.tuple([serverIdSchema]), (_e, [id]): IpcResponse => {
    configStore.removeServer(id);
    connectionManager.removeClient(id);
    return { success: true };
  });

  handleGuarded(isTrusted, IPC.SERVER_SET_ACTIVE, z.tuple([serverIdSchema.nullable()]), (_e, [id]): IpcResponse => {
    configStore.setActiveServerId(id);
    if (id) {
      const server = configStore.getServers().find(s => s.id === id);
      if (server) {
        connectionManager.setActiveServer(server);
      }
    }
    return { success: true };
  });

  handleGuarded(isTrusted, IPC.SERVER_TEST, z.tuple([testServerSchema]), async (_e, [config]): Promise<IpcResponse> => {
    try {
      const testConfig: ServerConfig = { ...config, id: config.id ?? 'test' };
      const client = connectionManager.createTemporaryClient(testConfig);
      await client.request('session-get');
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  handleGuarded(isTrusted, IPC.PREFS_GET, none, (): IpcResponse<AppPreferences> => {
    return { success: true, data: configStore.getPreferences() };
  });

  handleGuarded(isTrusted, IPC.PREFS_SET, z.tuple([prefsPatchSchema]), (_e, [prefs]): IpcResponse => {
    if (!isWatchFolderAllowed(prefs.watchFolder)) {
      return { success: false, error: 'Watch folder must be chosen with the folder dialog' };
    }
    configStore.updatePreferences(prefs);
    return { success: true };
  });

  handleGuarded(isTrusted, IPC.CONFIG_EXPORT, z.tuple([exportOptionsSchema]), (_e, [options]): IpcResponse => {
    const result: Record<string, unknown> = { version: 1, exportedAt: new Date().toISOString() };
    if (options.servers !== false) {
      const allServers = configStore.getServers();
      const wanted = options.serverIds;
      result.servers = wanted ? allServers.filter(s => wanted.includes(s.id)) : allServers;
    }
    if (options.preferences) {
      result.preferences = configStore.getPreferences();
    }
    return { success: true, data: result };
  });

  // Data is either the parsed JSON itself or { filePath } of a dialog-approved file.
  handleGuarded(isTrusted, IPC.CONFIG_IMPORT, z.tuple([importRequestSchema]), (_e, [request]): IpcResponse => {
    try {
      return applyImport(resolveImportData(request));
    } catch (err) {
      console.error('[Import] Failed:', err instanceof Error ? err.name : 'unknown error');
      const reason = err instanceof ApprovedPathError ? err.message : 'invalid file';
      return { success: false, error: `Import failed: ${reason}` };
    }
  });
}
