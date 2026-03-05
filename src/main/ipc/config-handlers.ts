import { ipcMain, dialog } from 'electron';
import fs from 'node:fs';
import { IPC } from '@shared/ipc-channels';
import type { IpcResponse, NewServerConfig, ServerConfig, AppPreferences } from '@shared/types';
import { configStore } from '../store/config-store';
import { connectionManager } from '../rpc/connection-manager';
import { randomUUID } from 'node:crypto';

export function registerConfigHandlers(): void {
  ipcMain.handle(IPC.SERVER_LIST, (): IpcResponse<ServerConfig[]> => {
    return { success: true, data: configStore.getServers() };
  });

  ipcMain.handle(IPC.SERVER_ADD, (_, config: NewServerConfig): IpcResponse<ServerConfig> => {
    const server: ServerConfig = { ...config, id: randomUUID() };
    configStore.addServer(server);
    return { success: true, data: server };
  });

  ipcMain.handle(IPC.SERVER_UPDATE, (_, id: string, updates: Partial<ServerConfig>): IpcResponse => {
    configStore.updateServer(id, updates);
    return { success: true };
  });

  ipcMain.handle(IPC.SERVER_REMOVE, (_, id: string): IpcResponse => {
    configStore.removeServer(id);
    connectionManager.removeClient(id);
    return { success: true };
  });

  ipcMain.handle(IPC.SERVER_SET_ACTIVE, (_, id: string | null): IpcResponse => {
    configStore.setActiveServerId(id);
    if (id) {
      const server = configStore.getServers().find(s => s.id === id);
      if (server) {
        connectionManager.setActiveServer(server);
      }
    }
    return { success: true };
  });

  ipcMain.handle(IPC.SERVER_TEST, async (_, config: ServerConfig | NewServerConfig): Promise<IpcResponse> => {
    try {
      const testConfig = { ...config, id: 'id' in config ? config.id : 'test' } as ServerConfig;
      const client = connectionManager.createTemporaryClient(testConfig);
      await client.request('session-get');
      return { success: true };
    } catch (err) {
      return { success: false, error: (err as Error).message };
    }
  });

  ipcMain.handle(IPC.PREFS_GET, (): IpcResponse<AppPreferences> => {
    return { success: true, data: configStore.getPreferences() };
  });

  ipcMain.handle(IPC.PREFS_SET, (_, prefs: Partial<AppPreferences>): IpcResponse => {
    configStore.updatePreferences(prefs);
    return { success: true };
  });

  ipcMain.handle(IPC.READ_FILE_BASE64, async (_, filePath: string): Promise<IpcResponse<string>> => {
    try {
      const content = fs.readFileSync(filePath);
      return { success: true, data: content.toString('base64') };
    } catch {
      return { success: false, error: 'Failed to read file' };
    }
  });

  ipcMain.handle(IPC.DIALOG_OPEN_FILE, async (_, options?: Electron.OpenDialogOptions): Promise<IpcResponse<string[]>> => {
    const result = await dialog.showOpenDialog(options ?? {
      properties: ['openFile'],
      filters: [{ name: 'Torrent Files', extensions: ['torrent'] }],
    });
    if (result.canceled) return { success: true, data: [] };
    return { success: true, data: result.filePaths };
  });

  // Config export
  ipcMain.handle(IPC.CONFIG_EXPORT, (_, options: { servers?: boolean; preferences?: boolean; serverIds?: string[] }): IpcResponse => {
    const result: Record<string, unknown> = { version: 1, exportedAt: new Date().toISOString() };
    if (options.servers !== false) {
      const allServers = configStore.getServers();
      result.servers = options.serverIds
        ? allServers.filter(s => options.serverIds!.includes(s.id))
        : allServers;
    }
    if (options.preferences) {
      result.preferences = configStore.getPreferences();
    }
    return { success: true, data: result };
  });

  // Config import (data can be the parsed JSON directly, or { filePath } to read from disk)
  ipcMain.handle(IPC.CONFIG_IMPORT, (_, data: { servers?: ServerConfig[]; preferences?: Partial<AppPreferences>; filePath?: string }): IpcResponse => {
    if (data.filePath) {
      try {
        const raw = fs.readFileSync(data.filePath, 'utf-8');
        data = JSON.parse(raw);
      } catch (err) {
        return { success: false, error: (err as Error).message };
      }
    }
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
      const { columnVisibility, columnSizing, columnOrder, ...rest } = data.preferences;
      configStore.updatePreferences({ ...rest, columnVisibility, columnSizing, columnOrder });
      prefsImported = true;
    }

    return { success: true, data: { serversAdded, serversSkipped, prefsImported } };
  });

  // Save file dialog
  ipcMain.handle(IPC.DIALOG_SAVE_FILE, async (_, options: { defaultPath?: string; filters?: Electron.FileFilter[] }, content: string): Promise<IpcResponse<string | null>> => {
    const result = await dialog.showSaveDialog({
      defaultPath: options.defaultPath,
      filters: options.filters ?? [{ name: 'JSON', extensions: ['json'] }],
    });
    if (result.canceled || !result.filePath) return { success: true, data: null };
    fs.writeFileSync(result.filePath, content, 'utf-8');
    return { success: true, data: result.filePath };
  });

  ipcMain.handle(IPC.DIALOG_OPEN_DIRECTORY, async (): Promise<IpcResponse<string | null>> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled) return { success: true, data: null };
    return { success: true, data: result.filePaths[0] };
  });
}
