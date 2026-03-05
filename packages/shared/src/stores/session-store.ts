import { create } from 'zustand';
import type { SessionSettings, SessionStats } from '../types/session';
import { keysToCarmel, keysToKebab } from '../key-utils';
import { getPlatformApi } from '../platform/api-store';

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
  updateSettings: (changes: Record<string, unknown>) => Promise<boolean>;
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
    const res = await getPlatformApi().rpcSessionGet();
    if (res.success && res.data) {
      set({ settings: keysToCarmel<SessionSettings>(res.data) });
    }
  },

  updateSettings: async (changes) => {
    const res = await getPlatformApi().rpcSessionSet(keysToKebab(changes));
    if (res.success) {
      await get().fetchSettings();
    }
    return res.success;
  },

  fetchStats: async () => {
    const res = await getPlatformApi().rpcSessionStats();
    if (res.success && res.data) {
      set({ stats: keysToCarmel<SessionStats>(res.data) });
    }
  },

  fetchFreeSpace: async (path) => {
    const res = await getPlatformApi().rpcFreeSpace(path);
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
      const res = await getPlatformApi().rpcFreeSpace(p);
      if (res.success && res.data) {
        const data = res.data as { 'size-bytes'?: number; total_size?: number; path?: string };
        const free = data['size-bytes'] ?? data.total_size ?? 0;
        results.push({ path: data.path ?? p, freeSpace: free });
      }
    }
    set({ freeSpaceDetails: results });
  },

  toggleAltSpeed: async () => {
    const current = get().settings?.altSpeedEnabled ?? false;
    await getPlatformApi().rpcSessionSet({ 'alt-speed-enabled': !current });
    await get().fetchSettings();
  },

  testPort: async () => {
    const res = await getPlatformApi().rpcPortTest();
    return { success: res.success, data: res.data };
  },

  updateBlocklist: async () => {
    const res = await getPlatformApi().rpcBlocklistUpdate();
    if (res.success) {
      await get().fetchSettings();
    }
    return { success: res.success, data: res.data };
  },

  reset: () => {
    set({ settings: null, stats: null, freeSpace: null, totalSpace: null, freeSpaceDetails: null });
  },
}));
