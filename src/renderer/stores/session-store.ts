import { create } from 'zustand';
import type { SessionSettings, SessionStats } from '../types/session';

export interface FreeSpaceDetail {
  path: string;
  freeSpace: number;
}

interface SessionStore {
  settings: SessionSettings | null;
  stats: SessionStats | null;
  freeSpace: number | null;
  totalSpace: number | null;
  freeSpaceDetails: FreeSpaceDetail[] | null;

  fetchSettings: () => Promise<void>;
  updateSettings: (changes: Record<string, unknown>) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchFreeSpace: (path: string) => Promise<void>;
  fetchFreeSpaceDetails: (paths: string[]) => Promise<void>;
  toggleAltSpeed: () => Promise<void>;
  testPort: () => Promise<{ success: boolean; data?: unknown }>;
  updateBlocklist: () => Promise<{ success: boolean; data?: unknown }>;

  reset: () => void;
}

export const useSessionStore = create<SessionStore>((set, get) => ({
  settings: null,
  stats: null,
  freeSpace: null,
  totalSpace: null,
  freeSpaceDetails: null,

  fetchSettings: async () => {
    const res = await window.api.rpcSessionGet();
    if (res.success && res.data) {
      set({ settings: res.data as unknown as SessionSettings });
    }
  },

  updateSettings: async (changes) => {
    const res = await window.api.rpcSessionSet(changes);
    if (res.success) {
      await get().fetchSettings();
    }
  },

  fetchStats: async () => {
    const res = await window.api.rpcSessionStats();
    if (res.success && res.data) {
      set({ stats: res.data as unknown as SessionStats });
    }
  },

  fetchFreeSpace: async (path) => {
    const res = await window.api.rpcFreeSpace(path);
    if (res.success && res.data) {
      const data = res.data as { 'size-bytes'?: number; total_size?: number };
      set({
        freeSpace: data['size-bytes'] ?? null,
        totalSpace: data.total_size ?? null,
      });
    }
  },

  fetchFreeSpaceDetails: async (paths) => {
    const results: FreeSpaceDetail[] = [];
    for (const p of paths) {
      const res = await window.api.rpcFreeSpace(p);
      if (res.success && res.data) {
        const data = res.data as { 'size-bytes'?: number; total_size?: number; path?: string };
        const free = data['size-bytes'] ?? data.total_size ?? 0;
        results.push({ path: data.path ?? p, freeSpace: free });
      }
    }
    set({ freeSpaceDetails: results });
  },

  toggleAltSpeed: async () => {
    const s = get().settings as Record<string, unknown> | null;
    const current = (s?.['alt-speed-enabled'] ?? s?.altSpeedEnabled ?? false) as boolean;
    await window.api.rpcSessionSet({ 'alt-speed-enabled': !current });
    await get().fetchSettings();
  },

  testPort: async () => {
    const res = await window.api.rpcPortTest();
    return { success: res.success, data: res.data };
  },

  updateBlocklist: async () => {
    const res = await window.api.rpcBlocklistUpdate();
    if (res.success) {
      await get().fetchSettings();
    }
    return { success: res.success, data: res.data };
  },

  reset: () => {
    set({ settings: null, stats: null, freeSpace: null, totalSpace: null, freeSpaceDetails: null });
  },
}));
