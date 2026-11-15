import { create } from 'zustand';
import type { ServerConfig, NewServerConfig } from '../types/server';
import { getPlatformApi } from '../platform/api-store';
import { useTorrentStore } from './torrent-store';
import { useSessionStore } from './session-store';
import { bumpServerEpoch, isServerEpochCurrent } from '../lib/server-epoch';

interface ServerStore {
  servers: ServerConfig[];
  activeServerId: string | null;
  connectionStatus: 'disconnected' | 'connecting' | 'connected' | 'error';
  connectionError: string | null;

  fetchServers: () => Promise<void>;
  addServer: (config: NewServerConfig) => Promise<ServerConfig | null>;
  updateServer: (id: string, updates: Partial<ServerConfig>) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  setActiveServer: (id: string | null) => Promise<void>;
  testConnection: (config: ServerConfig | NewServerConfig) => Promise<boolean>;
  setConnectionStatus: (status: ServerStore['connectionStatus'], error?: string) => void;
}

export const useServerStore = create<ServerStore>((set) => ({
  servers: [],
  activeServerId: null,
  connectionStatus: 'disconnected',
  connectionError: null,

  fetchServers: async () => {
    const res = await getPlatformApi().serverList();
    if (res.success && res.data) {
      set({ servers: res.data });
    }
  },

  addServer: async (config) => {
    const res = await getPlatformApi().serverAdd(config);
    if (res.success && res.data) {
      set((state) => ({ servers: [...state.servers, res.data!] }));
      return res.data;
    }
    return null;
  },

  updateServer: async (id, updates) => {
    const res = await getPlatformApi().serverUpdate(id, updates);
    if (res.success) {
      set((state) => ({
        servers: state.servers.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      }));
    }
  },

  removeServer: async (id) => {
    const res = await getPlatformApi().serverRemove(id);
    if (res.success) {
      if (useServerStore.getState().activeServerId === id) bumpServerEpoch();
      set((state) => ({
        servers: state.servers.filter((s) => s.id !== id),
        activeServerId: state.activeServerId === id ? null : state.activeServerId,
        connectionStatus: state.activeServerId === id ? 'disconnected' : state.connectionStatus,
      }));
    }
  },

  setActiveServer: async (id) => {
    // A newer call (or a server removal) makes every response of this one stale.
    const epoch = bumpServerEpoch();
    set({ connectionStatus: id ? 'connecting' : 'disconnected', connectionError: null });
    if (!id) {
      useTorrentStore.getState().reset();
      useSessionStore.getState().reset();
    }
    try {
      const res = await getPlatformApi().serverSetActive(id);
      if (!isServerEpochCurrent(epoch)) return;
      if (!res.success) {
        set({ connectionStatus: 'error', connectionError: res.error ?? 'Connection failed' });
        return;
      }
      set({ activeServerId: id });
      if (!id) return;
      const sessionRes = await getPlatformApi().rpcSessionGet();
      if (!isServerEpochCurrent(epoch)) return;
      if (sessionRes.success) {
        set({ connectionStatus: 'connected' });
      } else {
        set({ connectionStatus: 'error', connectionError: sessionRes.error ?? 'Connection failed' });
      }
    } catch (err) {
      if (!isServerEpochCurrent(epoch)) return;
      set({ connectionStatus: 'error', connectionError: err instanceof Error ? err.message : 'Connection failed' });
    }
  },

  testConnection: async (config) => {
    const res = await getPlatformApi().serverTest(config);
    return res.success;
  },

  setConnectionStatus: (status, error) => {
    set({ connectionStatus: status, connectionError: error ?? null });
  },
}));
