import type { ServerConfig, AppPreferences } from '@shared/types';

const STORAGE_KEYS = {
  servers: 'seedora:servers',
  activeServerId: 'seedora:activeServerId',
  preferences: 'seedora:preferences',
} as const;

function getItem<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setItem(key: string, value: unknown): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Servers ──

export function getServers(): ServerConfig[] {
  return getItem<ServerConfig[]>(STORAGE_KEYS.servers) ?? [];
}

export function setServers(servers: ServerConfig[]): void {
  setItem(STORAGE_KEYS.servers, servers);
}

export function getActiveServerId(): string | null {
  return getItem<string>(STORAGE_KEYS.activeServerId);
}

export function setActiveServerId(id: string | null): void {
  setItem(STORAGE_KEYS.activeServerId, id);
}

// ── Preferences ──

const DEFAULT_PREFERENCES: AppPreferences = {
  pollingInterval: 5000,
  theme: 'system',
  minimizeToTray: false,
  closeToTray: false,
  showNotifications: true,
  relativeDates: true,
  language: '',
  watchFolderEnabled: false,
  deleteWatchedTorrent: false,
};

/** Preference keys without a default (layout state and the watch folder, which web ignores). */
const OPTIONAL_PREFERENCE_KEYS: ReadonlySet<string> = new Set([
  'columnVisibility',
  'columnSizing',
  'columnOrder',
  'speedPresets',
]);

export function getPreferences(): AppPreferences {
  const stored = getItem<Partial<AppPreferences>>(STORAGE_KEYS.preferences);
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return { ...DEFAULT_PREFERENCES };
  // Keys of removed features (`confirmOnAdd`, `pathMappings`) in old stored values are ignored.
  const known = Object.fromEntries(
    Object.entries(stored).filter(([key]) => key in DEFAULT_PREFERENCES || OPTIONAL_PREFERENCE_KEYS.has(key)),
  );
  return { ...DEFAULT_PREFERENCES, ...known };
}

export function setPreferences(prefs: Partial<AppPreferences>): void {
  const current = getPreferences();
  setItem(STORAGE_KEYS.preferences, { ...current, ...prefs });
}
