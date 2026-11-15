import { create } from 'zustand';
import type { SortingState, Updater } from '@tanstack/react-table';
import type { Torrent } from '../types/torrent';
import { TORRENT_LIST_FIELDS } from '../types/torrent';
import type { StatusFilter } from '../lib/constants';
import { getPlatformApi } from '../platform/api-store';
import type { PlatformApi } from '../platform/api-types';
import { currentServerEpoch, isServerEpochCurrent } from '../lib/server-epoch';
import { notifyFailure } from './notification-store';

/** True while the periodic refresh is failing, so the user is told once per outage. */
let refreshFailing = false;

function reportRefreshFailure(error: string | undefined): void {
  if (refreshFailing) return;
  refreshFailing = true;
  notifyFailure('notification.refreshFailed', error);
}

/**
 * Runs a platform call that reports failure through `{ success: false }` (or by
 * throwing) and surfaces any failure to the user. Resolves true on success.
 */
async function perform(call: () => Promise<{ success: boolean; error?: string }>): Promise<boolean> {
  try {
    const res = await call();
    if (res.success) return true;
    notifyFailure('notification.actionFailed', res.error);
  } catch (err) {
    notifyFailure('notification.actionFailed', err instanceof Error ? err.message : undefined);
  }
  return false;
}

interface TorrentStore {
  torrents: Map<number, Torrent>;
  selectedIds: Set<number>;
  lastSelectedId: number | null;
  sortingState: SortingState;
  globalFilter: string;
  statusFilter: StatusFilter;
  labelFilter: string | null;
  trackerFilter: string | null;
  folderFilter: string | null;
  isLoading: boolean;

  // Data fetching
  fetchTorrents: () => Promise<void>;
  fetchRecentlyActive: () => Promise<void>;

  // Selection
  selectTorrent: (id: number) => void;
  toggleTorrent: (id: number) => void;
  selectRange: (id: number, allVisibleIds: number[]) => void;
  selectAll: (allVisibleIds: number[]) => void;
  clearSelection: () => void;

  // Torrent actions
  startTorrents: (ids: number[]) => Promise<void>;
  startNowTorrents: (ids: number[]) => Promise<void>;
  stopTorrents: (ids: number[]) => Promise<void>;
  verifyTorrents: (ids: number[]) => Promise<void>;
  reannounceTorrents: (ids: number[]) => Promise<void>;
  removeTorrents: (ids: number[], deleteData: boolean) => Promise<void>;
  setTorrentProps: (ids: number[], props: Record<string, unknown>) => Promise<boolean>;
  moveTorrents: (ids: number[], location: string, move: boolean) => Promise<void>;
  queueMove: (ids: number[], direction: 'top' | 'up' | 'down' | 'bottom') => Promise<void>;
  addTorrent: (params: Record<string, unknown>) => Promise<{ success: boolean; error?: string; duplicate?: boolean; torrentName?: string; duplicateId?: number }>;
  startAll: () => Promise<void>;
  stopAll: () => Promise<void>;

  // Filters
  setGlobalFilter: (query: string) => void;
  setStatusFilter: (filter: StatusFilter) => void;
  setLabelFilter: (label: string | null) => void;
  setTrackerFilter: (tracker: string | null) => void;
  setFolderFilter: (folder: string | null) => void;
  setSortingState: (updater: Updater<SortingState>) => void;

  // Reset
  reset: () => void;
}

export const useTorrentStore = create<TorrentStore>((set, get) => ({
  torrents: new Map(),
  selectedIds: new Set(),
  lastSelectedId: null,
  sortingState: [{ id: 'addedDate', desc: true }],
  globalFilter: '',
  statusFilter: 'all',
  labelFilter: null,
  trackerFilter: null,
  folderFilter: null,
  isLoading: false,

  fetchTorrents: async () => {
    const epoch = currentServerEpoch();
    set({ isLoading: true });
    try {
      const res = await getPlatformApi().rpcTorrentGet(TORRENT_LIST_FIELDS as unknown as string[]);
      if (!isServerEpochCurrent(epoch)) return;
      const data = res.data as { torrents?: Torrent[] } | undefined;
      if (!res.success || !Array.isArray(data?.torrents)) {
        reportRefreshFailure(res.error);
        return;
      }
      refreshFailing = false;
      const map = new Map<number, Torrent>();
      for (const t of data.torrents) {
        map.set(t.id, t);
      }
      set({ torrents: map });
    } catch (err) {
      if (isServerEpochCurrent(epoch)) reportRefreshFailure(err instanceof Error ? err.message : undefined);
    } finally {
      if (isServerEpochCurrent(epoch)) set({ isLoading: false });
    }
  },

  fetchRecentlyActive: async () => {
    const epoch = currentServerEpoch();
    try {
      const res = await getPlatformApi().rpcTorrentGet(
        TORRENT_LIST_FIELDS as unknown as string[],
        'recently-active',
      );
      if (!isServerEpochCurrent(epoch)) return;
      const data = res.data as { torrents?: Torrent[]; removed?: number[] } | undefined;
      if (!res.success || !Array.isArray(data?.torrents)) {
        await get().fetchTorrents();
        return;
      }
      refreshFailing = false;
      const changed = data.torrents;
      set((state) => {
        const newMap = new Map(state.torrents);
        for (const t of changed) {
          newMap.set(t.id, t);
        }
        for (const id of data.removed ?? []) {
          newMap.delete(id);
        }
        return { torrents: newMap };
      });
    } catch {
      // Fallback to full fetch on error
      if (isServerEpochCurrent(epoch)) await get().fetchTorrents();
    }
  },

  selectTorrent: (id) => {
    set({ selectedIds: new Set([id]), lastSelectedId: id });
  },

  toggleTorrent: (id) => {
    set((state) => {
      const newSet = new Set(state.selectedIds);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return { selectedIds: newSet, lastSelectedId: id };
    });
  },

  selectRange: (id, allVisibleIds) => {
    set((state) => {
      const lastIdx = state.lastSelectedId !== null
        ? allVisibleIds.indexOf(state.lastSelectedId)
        : -1;
      const currentIdx = allVisibleIds.indexOf(id);
      if (lastIdx === -1 || currentIdx === -1) {
        return { selectedIds: new Set([id]), lastSelectedId: id };
      }
      const start = Math.min(lastIdx, currentIdx);
      const end = Math.max(lastIdx, currentIdx);
      const rangeIds = allVisibleIds.slice(start, end + 1);
      return { selectedIds: new Set([...state.selectedIds, ...rangeIds]), lastSelectedId: id };
    });
  },

  selectAll: (allVisibleIds) => {
    set({ selectedIds: new Set(allVisibleIds) });
  },

  clearSelection: () => {
    set({ selectedIds: new Set(), lastSelectedId: null });
  },

  startTorrents: async (ids) => {
    if (await perform(() => getPlatformApi().rpcTorrentStart(ids))) await get().fetchRecentlyActive();
  },

  startNowTorrents: async (ids) => {
    if (await perform(() => getPlatformApi().rpcTorrentStartNow(ids))) await get().fetchRecentlyActive();
  },

  stopTorrents: async (ids) => {
    if (await perform(() => getPlatformApi().rpcTorrentStop(ids))) await get().fetchRecentlyActive();
  },

  verifyTorrents: async (ids) => {
    if (await perform(() => getPlatformApi().rpcTorrentVerify(ids))) await get().fetchRecentlyActive();
  },

  reannounceTorrents: async (ids) => {
    await perform(() => getPlatformApi().rpcTorrentReannounce(ids));
  },

  removeTorrents: async (ids, deleteData) => {
    if (!(await perform(() => getPlatformApi().rpcTorrentRemove(ids, deleteData)))) return;
    set((state) => {
      const newMap = new Map(state.torrents);
      const newSelected = new Set(state.selectedIds);
      for (const id of ids) {
        newMap.delete(id);
        newSelected.delete(id);
      }
      return { torrents: newMap, selectedIds: newSelected };
    });
  },

  setTorrentProps: async (ids, props) => {
    const ok = await perform(() => getPlatformApi().rpcTorrentSet(ids, props));
    if (ok) await get().fetchRecentlyActive();
    return ok;
  },

  moveTorrents: async (ids, location, move) => {
    if (await perform(() => getPlatformApi().rpcTorrentSetLocation(ids, location, move))) {
      await get().fetchRecentlyActive();
    }
  },

  queueMove: async (ids, direction) => {
    const api = getPlatformApi();
    const methods = {
      top: () => api.rpcQueueMoveTop(ids),
      up: () => api.rpcQueueMoveUp(ids),
      down: () => api.rpcQueueMoveDown(ids),
      bottom: () => api.rpcQueueMoveBottom(ids),
    };
    if (await perform(methods[direction])) await get().fetchRecentlyActive();
  },

  addTorrent: async (params) => {
    let res: Awaited<ReturnType<PlatformApi['rpcTorrentAdd']>>;
    try {
      res = await getPlatformApi().rpcTorrentAdd(params);
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : undefined };
    }
    if (res.success) {
      const data = res.data as Record<string, unknown> | undefined;
      const duplicate = data?.['torrent-duplicate'] as Record<string, unknown> | undefined;
      if (duplicate) {
        return { success: false, duplicate: true, torrentName: duplicate.name as string | undefined, duplicateId: duplicate.id as number | undefined };
      }
      await get().fetchTorrents();
    }
    return { success: res.success, error: res.error };
  },

  startAll: async () => {
    const ids = Array.from(get().torrents.keys());
    if (ids.length > 0 && (await perform(() => getPlatformApi().rpcTorrentStart(ids)))) {
      await get().fetchRecentlyActive();
    }
  },

  stopAll: async () => {
    const ids = Array.from(get().torrents.keys());
    if (ids.length > 0 && (await perform(() => getPlatformApi().rpcTorrentStop(ids)))) {
      await get().fetchRecentlyActive();
    }
  },

  setGlobalFilter: (query) => set({ globalFilter: query }),
  setStatusFilter: (filter) => set({ statusFilter: filter }),
  setLabelFilter: (label) => set({ labelFilter: label }),
  setTrackerFilter: (tracker) => set({ trackerFilter: tracker }),
  setFolderFilter: (folder) => set({ folderFilter: folder }),
  setSortingState: (updater) => set((prev) => ({
    sortingState: typeof updater === 'function' ? updater(prev.sortingState) : updater,
  })),

  reset: () => {
    refreshFailing = false;
    set({
      torrents: new Map(),
      selectedIds: new Set(),
      lastSelectedId: null,
      isLoading: false,
      globalFilter: '',
      statusFilter: 'all',
      labelFilter: null,
      trackerFilter: null,
      folderFilter: null,
    });
  },
}));
