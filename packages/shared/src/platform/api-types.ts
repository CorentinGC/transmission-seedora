import type { LaunchTarget, IpcResponse, ServerConfig, NewServerConfig, ServerConfigPatch, AppPreferences } from '../types';

/**
 * Platform-agnostic API interface.
 * Electron implements this via window.api (IPC), Web via server actions (fetch).
 * Optional methods are Electron-only and may not be available on web.
 */
export interface PlatformApi {
  // Server management
  serverList(): Promise<IpcResponse<ServerConfig[]>>;
  serverAdd(config: NewServerConfig): Promise<IpcResponse<ServerConfig>>;
  serverUpdate(id: string, updates: ServerConfigPatch): Promise<IpcResponse>;
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
  /**
   * Server and proxy passwords are left out of the export unless `includePasswords` is true.
   * Without it: resolves the redacted JSON in `data` and the caller saves it.
   * With it on Electron: main confirms and shows the save dialog itself, writes the file and resolves
   * `{ success: true }` with NO data (secrets never cross IPC); a declined export is `{ success: false, code: 'CANCELLED' }`.
   * On web the data is returned and downloaded client-side.
   */
  configExport(options: {
    servers?: boolean;
    preferences?: boolean;
    serverIds?: string[];
    includePasswords?: boolean;
  }): Promise<IpcResponse>;
  /** Validates then MERGES a backup: servers deduped by host+port+path (active server kept, `allowSelfSigned` dropped); resolves `data: { serversAdded, serversSkipped, prefsImported }`. */
  configImport(data: Record<string, unknown>): Promise<IpcResponse>;

  // Preferences
  prefsGet(): Promise<IpcResponse<AppPreferences>>;
  prefsSet(prefs: Partial<AppPreferences>): Promise<IpcResponse>;

  // Platform-specific (optional — not available on web)
  readFileBase64?(filePath: string): Promise<IpcResponse<string>>;
  dialogOpenFile?(options?: Record<string, unknown>): Promise<IpcResponse<string[]>>;
  dialogOpenDirectory?(options?: { purpose?: 'watch-folder' }): Promise<IpcResponse<string | null>>;
  dialogSaveFile?(options: Record<string, unknown>, content: string): Promise<IpcResponse<string | null>>;
  /** True when stored secrets are encrypted by the OS keychain; false means they sit in plain text. Electron only. */
  secretStorageEncrypted?(): Promise<IpcResponse<boolean>>;
  trayUpdate?(state: { downloadSpeed: number; uploadSpeed: number; activeCount: number; altSpeedEnabled: boolean }): void;
  notificationShow?(title: string, body: string): void;
  watcherRestart?(): void;
  geoipLookup?(ips: string[]): Promise<IpcResponse<Record<string, { country: string; region: string; city: string } | null>>>;
  /** Pulls the magnet links / .torrent files the OS asked the app to open before the UI subscribed (then listen to the `launch:target` menu event for later ones). */
  /** Whether stored passwords are encrypted by the OS secret store; false means cleartext in a 0600 file (show a warning). Electron only. */
  secretStorageEncrypted?(): Promise<IpcResponse<boolean>>;
  launchTargetsTake?(): Promise<IpcResponse<LaunchTarget[]>>;
  onMenuEvent?(channel: string, callback: (...args: unknown[]) => void): (() => void);
}
