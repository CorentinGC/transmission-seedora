// ── Server Configuration ──

export interface ServerConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  path: string;
  useSSL: boolean;
  username?: string;
  password?: string;
  proxyType?: 'none' | 'http' | 'socks5';
  proxyHost?: string;
  proxyPort?: number;
  proxyUsername?: string;
  proxyPassword?: string;
}

export type NewServerConfig = Omit<ServerConfig, 'id'>;

// ── App Preferences ──

export interface AppPreferences {
  pollingInterval: number;
  theme: 'light' | 'dark' | 'system';
  minimizeToTray: boolean;
  closeToTray: boolean;
  showNotifications: boolean;
  confirmOnAdd: boolean;
  relativeDates: boolean;
  language: string;
  watchFolder?: string;
  watchFolderEnabled: boolean;
  deleteWatchedTorrent: boolean;
  pathMappings: PathMapping[];
  columnVisibility?: Record<string, boolean>;
  columnSizing?: Record<string, number>;
  columnOrder?: string[];
  speedPresets?: number[];
}

export interface PathMapping {
  remote: string;
  local: string;
}

// ── IPC Response Envelope ──

export interface IpcResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}
