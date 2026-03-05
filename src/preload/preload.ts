import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '@shared/ipc-channels';
import type { IpcResponse, ServerConfig, NewServerConfig, AppPreferences } from '@shared/types';

const api = {
  // Server management
  serverList: (): Promise<IpcResponse<ServerConfig[]>> =>
    ipcRenderer.invoke(IPC.SERVER_LIST),
  serverAdd: (config: NewServerConfig): Promise<IpcResponse<ServerConfig>> =>
    ipcRenderer.invoke(IPC.SERVER_ADD, config),
  serverUpdate: (id: string, updates: Partial<ServerConfig>): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.SERVER_UPDATE, id, updates),
  serverRemove: (id: string): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.SERVER_REMOVE, id),
  serverSetActive: (id: string | null): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.SERVER_SET_ACTIVE, id),
  serverTest: (config: ServerConfig | NewServerConfig): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.SERVER_TEST, config),

  // RPC torrent
  rpcTorrentGet: (fields: string[], ids?: number[] | 'recently-active'): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_TORRENT_GET, fields, ids),
  rpcTorrentSet: (ids: number[], params: Record<string, unknown>): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_TORRENT_SET, ids, params),
  rpcTorrentAdd: (params: Record<string, unknown>): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_TORRENT_ADD, params),
  rpcTorrentRemove: (ids: number[], deleteLocalData: boolean): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_TORRENT_REMOVE, ids, deleteLocalData),
  rpcTorrentStart: (ids: number[]): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_TORRENT_START, ids),
  rpcTorrentStartNow: (ids: number[]): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_TORRENT_START_NOW, ids),
  rpcTorrentStop: (ids: number[]): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_TORRENT_STOP, ids),
  rpcTorrentVerify: (ids: number[]): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_TORRENT_VERIFY, ids),
  rpcTorrentReannounce: (ids: number[]): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_TORRENT_REANNOUNCE, ids),
  rpcTorrentSetLocation: (ids: number[], location: string, move: boolean): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_TORRENT_SET_LOCATION, ids, location, move),
  rpcTorrentRenamePath: (ids: number[], path: string, name: string): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_TORRENT_RENAME_PATH, ids, path, name),

  // RPC queue
  rpcQueueMoveTop: (ids: number[]): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_QUEUE_MOVE_TOP, ids),
  rpcQueueMoveUp: (ids: number[]): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_QUEUE_MOVE_UP, ids),
  rpcQueueMoveDown: (ids: number[]): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_QUEUE_MOVE_DOWN, ids),
  rpcQueueMoveBottom: (ids: number[]): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_QUEUE_MOVE_BOTTOM, ids),

  // RPC session
  rpcSessionGet: (fields?: string[]): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_SESSION_GET, fields),
  rpcSessionSet: (params: Record<string, unknown>): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_SESSION_SET, params),
  rpcSessionStats: (): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_SESSION_STATS),
  rpcSessionClose: (): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_SESSION_CLOSE),

  // RPC utilities
  rpcFreeSpace: (path: string): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_FREE_SPACE, path),
  rpcPortTest: (): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_PORT_TEST),
  rpcBlocklistUpdate: (): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_BLOCKLIST_UPDATE),
  rpcGroupGet: (group?: string | string[]): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_GROUP_GET, group),
  rpcGroupSet: (params: Record<string, unknown>): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.RPC_GROUP_SET, params),

  // Config export/import
  configExport: (options: { servers?: boolean; preferences?: boolean; serverIds?: string[] }): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.CONFIG_EXPORT, options),
  configImport: (data: Record<string, unknown>): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.CONFIG_IMPORT, data),
  dialogSaveFile: (options: { defaultPath?: string; filters?: Electron.FileFilter[] }, content: string): Promise<IpcResponse<string | null>> =>
    ipcRenderer.invoke(IPC.DIALOG_SAVE_FILE, options, content),

  // Preferences
  prefsGet: (): Promise<IpcResponse<AppPreferences>> =>
    ipcRenderer.invoke(IPC.PREFS_GET),
  prefsSet: (prefs: Partial<AppPreferences>): Promise<IpcResponse> =>
    ipcRenderer.invoke(IPC.PREFS_SET, prefs),

  // Dialogs
  dialogOpenFile: (options?: Electron.OpenDialogOptions): Promise<IpcResponse<string[]>> =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_FILE, options),
  dialogOpenDirectory: (): Promise<IpcResponse<string | null>> =>
    ipcRenderer.invoke(IPC.DIALOG_OPEN_DIRECTORY),

  // Tray
  trayUpdate: (state: { downloadSpeed: number; uploadSpeed: number; activeCount: number; altSpeedEnabled: boolean }): void =>
    ipcRenderer.send(IPC.TRAY_UPDATE, state),

  // Notifications
  notificationShow: (title: string, body: string): void =>
    ipcRenderer.send(IPC.NOTIFICATION_SHOW, { title, body }),

  // Watcher
  watcherRestart: (): void =>
    ipcRenderer.send(IPC.WATCHER_RESTART),

  // GeoIP
  geoipLookup: (ips: string[]): Promise<IpcResponse<Record<string, { country: string; region: string; city: string } | null>>> =>
    ipcRenderer.invoke(IPC.GEOIP_LOOKUP, ips),

  // Menu events (renderer listens)
  onMenuEvent: (channel: string, callback: (...args: unknown[]) => void): (() => void) => {
    const listener = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, listener);
    return () => ipcRenderer.removeListener(channel, listener);
  },
};

export type ElectronApi = typeof api;

contextBridge.exposeInMainWorld('api', api);
