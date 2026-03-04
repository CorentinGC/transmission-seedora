import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import type { ServerConfig, AppPreferences } from '@shared/types';

interface StoreData {
  servers: ServerConfig[];
  activeServerId: string | null;
  preferences: AppPreferences;
}

const DEFAULT_PREFERENCES: AppPreferences = {
  pollingInterval: 3000,
  theme: 'system',
  minimizeToTray: false,
  closeToTray: false,
  showNotifications: true,
  confirmOnAdd: true,
  relativeDates: true,
  language: 'en',
  watchFolderEnabled: false,
  deleteWatchedTorrent: false,
  pathMappings: [],
};

const DEFAULTS: StoreData = {
  servers: [],
  activeServerId: null,
  preferences: DEFAULT_PREFERENCES,
};

function getConfigPath(): string {
  return path.join(app.getPath('userData'), 'config.json');
}

function readStore(): StoreData {
  try {
    const raw = fs.readFileSync(getConfigPath(), 'utf-8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

function writeStore(data: StoreData): void {
  fs.writeFileSync(getConfigPath(), JSON.stringify(data, null, 2), 'utf-8');
}

export const configStore = {
  getServers(): ServerConfig[] {
    return readStore().servers;
  },

  addServer(server: ServerConfig): void {
    const data = readStore();
    data.servers.push(server);
    writeStore(data);
  },

  updateServer(id: string, updates: Partial<ServerConfig>): void {
    const data = readStore();
    const index = data.servers.findIndex(s => s.id === id);
    if (index !== -1) {
      data.servers[index] = { ...data.servers[index], ...updates };
      writeStore(data);
    }
  },

  removeServer(id: string): void {
    const data = readStore();
    data.servers = data.servers.filter(s => s.id !== id);
    if (data.activeServerId === id) {
      data.activeServerId = null;
    }
    writeStore(data);
  },

  getActiveServerId(): string | null {
    return readStore().activeServerId;
  },

  setActiveServerId(id: string | null): void {
    const data = readStore();
    data.activeServerId = id;
    writeStore(data);
  },

  getPreferences(): AppPreferences {
    return readStore().preferences;
  },

  updatePreferences(updates: Partial<AppPreferences>): void {
    const data = readStore();
    data.preferences = { ...data.preferences, ...updates };
    writeStore(data);
  },
};
