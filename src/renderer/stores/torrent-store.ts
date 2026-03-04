import { create } from 'zustand';
import type { SortingState, ColumnFiltersState, Updater } from '@tanstack/react-table';
import type { Torrent } from '../types/torrent';
import { TORRENT_LIST_FIELDS } from '../types/torrent';
import type { StatusFilter } from '../lib/constants';

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
  setTorrentProps: (ids: number[], props: Record<string, unknown>) => Promise<void>;
  moveTorrents: (ids: number[], location: string, move: boolean) => Promise<void>;
  queueMove: (ids: number[], direction: 'top' | 'up' | 'down' | 'bottom') => Promise<void>;
  addTorrent: (params: Record<string, unknown>) => Promise<{ success: boolean; error?: string }>;
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
  sortingState: [{ id: 'name', desc: false }],
  globalFilter: '',
  statusFilter: 'all',
  labelFilter: null,
  trackerFilter: null,
  folderFilter: null,
  isLoading: false,

  fetchTorrents: async () => {
    set({ isLoading: true });
    try {
      const res = await window.api.rpcTorrentGet(TORRENT_LIST_FIELDS as unknown as string[]);
      if (res.success && res.data) {
        const data = res.data as { torrents: Torrent[] };
        const map = new Map<number, Torrent>();
        for (const t of data.torrents) {
          map.set(t.id, t);
        }
        set({ torrents: map });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  fetchRecentlyActive: async () => {
    try {
      const res = await window.api.rpcTorrentGet(
        TORRENT_LIST_FIELDS as unknown as string[],
        'recently-active',
      );
      if (res.success && res.data) {
        const data = res.data as { torrents: Torrent[]; removed?: number[] };
        set((state) => {
          const newMap = new Map(state.torrents);
          for (const t of data.torrents) {
            newMap.set(t.id, t);
          }
          if (data.removed) {
            for (const id of data.removed) {
              newMap.delete(id);
            }
          }
          return { torrents: newMap };
        });
      }
    } catch {
      // Fallback to full fetch on error
      await get().fetchTorrents();
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
    await window.api.rpcTorrentStart(ids);
    await get().fetchRecentlyActive();
  },

  startNowTorrents: async (ids) => {
    await window.api.rpcTorrentStartNow(ids);
    await get().fetchRecentlyActive();
  },

  stopTorrents: async (ids) => {
    await window.api.rpcTorrentStop(ids);
    await get().fetchRecentlyActive();
  },

  verifyTorrents: async (ids) => {
    await window.api.rpcTorrentVerify(ids);
    await get().fetchRecentlyActive();
  },

  reannounceTorrents: async (ids) => {
    await window.api.rpcTorrentReannounce(ids);
  },

  removeTorrents: async (ids, deleteData) => {
    await window.api.rpcTorrentRemove(ids, deleteData);
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
    await window.api.rpcTorrentSet(ids, props);
    await get().fetchRecentlyActive();
  },

  moveTorrents: async (ids, location, move) => {
    await window.api.rpcTorrentSetLocation(ids, location, move);
    await get().fetchRecentlyActive();
  },

  queueMove: async (ids, direction) => {
    const methods: Record<string, typeof window.api.rpcQueueMoveTop> = {
      top: window.api.rpcQueueMoveTop,
      up: window.api.rpcQueueMoveUp,
      down: window.api.rpcQueueMoveDown,
      bottom: window.api.rpcQueueMoveBottom,
    };
    await methods[direction](ids);
    await get().fetchRecentlyActive();
  },

  addTorrent: async (params) => {
    const res = await window.api.rpcTorrentAdd(params);
    if (res.success) {
      await get().fetchTorrents();
    }
    return { success: res.success, error: res.error };
  },

  startAll: async () => {
    const ids = Array.from(get().torrents.keys());
    if (ids.length > 0) {
      await window.api.rpcTorrentStart(ids);
      await get().fetchRecentlyActive();
    }
  },

  stopAll: async () => {
    const ids = Array.from(get().torrents.keys());
    if (ids.length > 0) {
      await window.api.rpcTorrentStop(ids);
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
