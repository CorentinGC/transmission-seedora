// ── Server Configuration ──

export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  path: string;
  useSSL: boolean;
  /** Accept a self-signed or otherwise untrusted TLS certificate for this server (default false). */
  allowSelfSigned?: boolean;
  username?: string;
  password?: string;
  proxyType?: 'none' | 'http' | 'socks5';
  proxyHost?: string;
  proxyPort?: number;
  proxyUsername?: string;
  proxyPassword?: string;
  /** Set by main on every server it returns to the renderer: a password is stored (the password itself is never sent). */
  hasPassword?: boolean;
  /** Same as `hasPassword`, for the proxy password. */
  hasProxyPassword?: boolean;
}

export type NewServerConfig = Omit<ServerConfig, 'id'>;

/** A server update: any server field, plus explicit requests to remove a stored password (empty means unchanged). */
export type ServerConfigPatch = Partial<ServerConfig> & { clearPassword?: boolean; clearProxyPassword?: boolean };

// ── App Preferences ──

export interface AppPreferences {
  pollingInterval: number;
  theme: 'light' | 'dark' | 'system';
  minimizeToTray: boolean;
  closeToTray: boolean;
  showNotifications: boolean;
  relativeDates: boolean;
  language: string;
  watchFolder?: string;
  watchFolderEnabled: boolean;
  deleteWatchedTorrent: boolean;
  columnVisibility?: Record<string, boolean>;
  columnSizing?: Record<string, number>;
  columnOrder?: string[];
  speedPresets?: number[];
}

// ── IPC Response Envelope ──

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  /** Machine-readable failure kind (RPC transport errors, user-declined confirmations) the renderer can translate. */
  code?: string;
}

// ── Launch targets (magnet links and .torrent files the OS asks the app to open) ──

/** Validated by main. A `torrent-file` path is already approved for reading through `readFileBase64` / `rpcTorrentAdd`. */
export type LaunchTarget = { kind: 'magnet'; uri: string } | { kind: 'torrent-file'; filePath: string };
