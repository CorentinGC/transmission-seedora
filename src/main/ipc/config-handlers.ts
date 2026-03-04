import { ipcMain, dialog } from 'electron';
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

  ipcMain.handle(IPC.DIALOG_OPEN_FILE, async (_, options?: Electron.OpenDialogOptions): Promise<IpcResponse<string[]>> => {
    const result = await dialog.showOpenDialog(options ?? {
      properties: ['openFile'],
      filters: [{ name: 'Torrent Files', extensions: ['torrent'] }],
    });
    if (result.canceled) return { success: true, data: [] };
    return { success: true, data: result.filePaths };
  });

  ipcMain.handle(IPC.DIALOG_OPEN_DIRECTORY, async (): Promise<IpcResponse<string | null>> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
    });
    if (result.canceled) return { success: true, data: null };
    return { success: true, data: result.filePaths[0] };
  });
}
