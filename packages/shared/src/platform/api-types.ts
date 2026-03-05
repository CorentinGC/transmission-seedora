import type { IpcResponse, ServerConfig, NewServerConfig, AppPreferences } from '../types';

/**
 * Platform-agnostic API interface.
 * Electron implements this via window.api (IPC), Web via server actions (fetch).
 * Optional methods are Electron-only and may not be available on web.
 */
export interface PlatformApi {
  // Server management
  serverList(): Promise<IpcResponse<ServerConfig[]>>;
  serverAdd(config: NewServerConfig): Promise<IpcResponse<ServerConfig>>;
  serverUpdate(id: string, updates: Partial<ServerConfig>): Promise<IpcResponse>;
  serverRemove(id: string): Promise<IpcResponse>;
  serverSetActive(id: string | null): Promise<IpcResponse>;
  serverTest(config: ServerConfig | NewServerConfig): Promise<IpcResponse>;

  // RPC torrent
  rpcTorrentGet(fields: string[], ids?: number[] | 'recently-active'): Promise<IpcResponse>;
  rpcTorrentSet(ids: number[], params: Record<string, unknown>): Promise<IpcResponse>;
  rpcTorrentAdd(params: Record<string, unknown>): Promise<IpcResponse>;
  rpcTorrentRemove(ids: number[], deleteLocalData: boolean): Promise<IpcResponse>;
  rpcTorrentStart(ids: number[]): Promise<IpcResponse>;
  rpcTorrentStartNow(ids: number[]): Promise<IpcResponse>;
  rpcTorrentStop(ids: number[]): Promise<IpcResponse>;
  rpcTorrentVerify(ids: number[]): Promise<IpcResponse>;
  rpcTorrentReannounce(ids: number[]): Promise<IpcResponse>;
  rpcTorrentSetLocation(ids: number[], location: string, move: boolean): Promise<IpcResponse>;
  rpcTorrentRenamePath(ids: number[], path: string, name: string): Promise<IpcResponse>;

  // RPC queue
  rpcQueueMoveTop(ids: number[]): Promise<IpcResponse>;
  rpcQueueMoveUp(ids: number[]): Promise<IpcResponse>;
  rpcQueueMoveDown(ids: number[]): Promise<IpcResponse>;
  rpcQueueMoveBottom(ids: number[]): Promise<IpcResponse>;

  // RPC session
  rpcSessionGet(fields?: string[]): Promise<IpcResponse>;
  rpcSessionSet(params: Record<string, unknown>): Promise<IpcResponse>;
  rpcSessionStats(): Promise<IpcResponse>;
  rpcSessionClose(): Promise<IpcResponse>;

  // RPC utilities
  rpcFreeSpace(path: string): Promise<IpcResponse>;
  rpcPortTest(): Promise<IpcResponse>;
  rpcBlocklistUpdate(): Promise<IpcResponse>;
  rpcGroupGet(group?: string | string[]): Promise<IpcResponse>;
  rpcGroupSet(params: Record<string, unknown>): Promise<IpcResponse>;

  // Config export/import
  configExport(options: { servers?: boolean; preferences?: boolean; serverIds?: string[] }): Promise<IpcResponse>;
  configImport(data: Record<string, unknown>): Promise<IpcResponse>;

  // Preferences
  prefsGet(): Promise<IpcResponse<AppPreferences>>;
  prefsSet(prefs: Partial<AppPreferences>): Promise<IpcResponse>;

  // Platform-specific (optional — not available on web)
  dialogOpenFile?(options?: Record<string, unknown>): Promise<IpcResponse<string[]>>;
  dialogOpenDirectory?(): Promise<IpcResponse<string | null>>;
  dialogSaveFile?(options: Record<string, unknown>, content: string): Promise<IpcResponse<string | null>>;
  trayUpdate?(state: { downloadSpeed: number; uploadSpeed: number; activeCount: number; altSpeedEnabled: boolean }): void;
  notificationShow?(title: string, body: string): void;
  watcherRestart?(): void;
  geoipLookup?(ips: string[]): Promise<IpcResponse<Record<string, { country: string; region: string; city: string } | null>>>;
  onMenuEvent?(channel: string, callback: (...args: unknown[]) => void): (() => void);
}
