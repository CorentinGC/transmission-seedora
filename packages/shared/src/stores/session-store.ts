import { create } from 'zustand';
import i18n from 'i18next';
import type { SessionSettings, SessionStats } from '../types/session';
import { keysToCarmel, keysToKebab } from '../key-utils';
import { getPlatformApi } from '../platform/api-store';
import { currentServerEpoch, isServerEpochCurrent } from '../lib/server-epoch';
import { notifyFailure } from './notification-store';

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

  /** Resolves with the error text when the refresh failed, null on success or when the response is stale. */
  fetchSettings: () => Promise<string | null>;
  updateSettings: (changes: Record<string, unknown>) => Promise<boolean>;
  /** Resolves with the error text when the refresh failed, null on success or when the response is stale. */
  fetchStats: () => Promise<string | null>;
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
    const epoch = currentServerEpoch();
    try {
      const res = await getPlatformApi().rpcSessionGet();
      if (!isServerEpochCurrent(epoch)) return null;
      if (!res.success) return res.error ?? i18n.t('details.requestFailed');
      if (res.data) set({ settings: keysToCarmel<SessionSettings>(res.data) });
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : i18n.t('details.requestFailed');
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
    const epoch = currentServerEpoch();
    try {
      const res = await getPlatformApi().rpcSessionStats();
      if (!isServerEpochCurrent(epoch)) return null;
      if (!res.success) return res.error ?? i18n.t('details.requestFailed');
      if (res.data) set({ stats: keysToCarmel<SessionStats>(res.data) });
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : i18n.t('details.requestFailed');
    }
  },

  fetchFreeSpace: async (path) => {
    const epoch = currentServerEpoch();
    const res = await getPlatformApi().rpcFreeSpace(path);
    if (isServerEpochCurrent(epoch) && res.success && res.data) {
      const data = res.data as { 'size-bytes'?: number; total_size?: number };
      set({
        freeSpace: data['size-bytes'] ?? null,
        totalSpace: data.total_size ?? null,
      });
    }
  },

  fetchFreeSpaceDetails: async (paths) => {
    const epoch = currentServerEpoch();
    const results: FreeSpaceDetail[] = [];
    for (const p of paths) {
      const res = await getPlatformApi().rpcFreeSpace(p);
      if (!isServerEpochCurrent(epoch)) return;
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
    const res = await getPlatformApi().rpcSessionSet({ 'alt-speed-enabled': !current });
    if (!res.success) {
      notifyFailure('notification.actionFailed', res.error);
      return;
    }
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
