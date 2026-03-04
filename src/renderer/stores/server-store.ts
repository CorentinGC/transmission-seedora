import { create } from 'zustand';
import type { ServerConfig, NewServerConfig } from '../types/server';

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

export const useServerStore = create<ServerStore>((set, get) => ({
  servers: [],
  activeServerId: null,
  connectionStatus: 'disconnected',
  connectionError: null,

  fetchServers: async () => {
    const res = await window.api.serverList();
    if (res.success && res.data) {
      set({ servers: res.data });
    }
  },

  addServer: async (config) => {
    const res = await window.api.serverAdd(config);
    if (res.success && res.data) {
      set((state) => ({ servers: [...state.servers, res.data!] }));
      return res.data;
    }
    return null;
  },

  updateServer: async (id, updates) => {
    const res = await window.api.serverUpdate(id, updates);
    if (res.success) {
      set((state) => ({
        servers: state.servers.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      }));
    }
  },

  removeServer: async (id) => {
    const res = await window.api.serverRemove(id);
    if (res.success) {
      set((state) => ({
        servers: state.servers.filter((s) => s.id !== id),
        activeServerId: state.activeServerId === id ? null : state.activeServerId,
        connectionStatus: state.activeServerId === id ? 'disconnected' : state.connectionStatus,
      }));
    }
  },

  setActiveServer: async (id) => {
    set({ connectionStatus: id ? 'connecting' : 'disconnected', connectionError: null });
    const res = await window.api.serverSetActive(id);
    if (res.success) {
      set({ activeServerId: id });
      if (id) {
        // Test connection
        try {
          const sessionRes = await window.api.rpcSessionGet();
          if (sessionRes.success) {
            set({ connectionStatus: 'connected' });
          } else {
            set({ connectionStatus: 'error', connectionError: sessionRes.error ?? 'Connection failed' });
          }
        } catch (err) {
          set({ connectionStatus: 'error', connectionError: (err as Error).message });
        }
      }
    }
  },

  testConnection: async (config) => {
    const res = await window.api.serverTest(config);
    return res.success;
  },

  setConnectionStatus: (status, error) => {
    set({ connectionStatus: status, connectionError: error ?? null });
  },
}));
