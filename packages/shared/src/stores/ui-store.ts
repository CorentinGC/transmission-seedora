import { create } from 'zustand';
import { getPlatformApi } from '../platform/api-store';

let persistTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedPersistColumns(state: { columnVisibility: Record<string, boolean>; columnSizing: Record<string, number>; columnOrder: string[] }) {
  if (persistTimer) clearTimeout(persistTimer);
  persistTimer = setTimeout(() => {
    getPlatformApi().prefsSet({
      columnVisibility: state.columnVisibility,
      columnSizing: state.columnSizing,
      columnOrder: state.columnOrder,
    });
  }, 500);
}

interface UiStore {
  // Layout
  detailsPanelVisible: boolean;
  detailsPanelSize: number;
  filterPanelVisible: boolean;
  filterPanelSize: number;

  // Table
  columnVisibility: Record<string, boolean>;
  columnSizing: Record<string, number>;
  columnOrder: string[];

  // Preferences
  theme: 'light' | 'dark' | 'system';
  pollingInterval: number;
  relativeDates: boolean;
  confirmOnAdd: boolean;
  speedPresets: number[] | null;

  // Actions
  setSpeedPresets: (presets: number[] | null) => void;
  toggleDetailsPanel: () => void;
  setDetailsPanelSize: (size: number) => void;
  toggleFilterPanel: () => void;
  setFilterPanelSize: (size: number) => void;
  setColumnVisibility: (vis: Record<string, boolean>) => void;
  setColumnSizing: (sizing: Record<string, number>) => void;
  setColumnOrder: (order: string[]) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setPollingInterval: (interval: number) => void;
  setRelativeDates: (value: boolean) => void;
  setConfirmOnAdd: (value: boolean) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  detailsPanelVisible: true,
  detailsPanelSize: 300,
  filterPanelVisible: true,
  filterPanelSize: 200,

  columnVisibility: {},
  columnSizing: {},
  columnOrder: [],

  theme: 'system',
  pollingInterval: 3000,
  relativeDates: false,
  confirmOnAdd: true,
  speedPresets: null,

  toggleDetailsPanel: () =>
    set((state) => ({ detailsPanelVisible: !state.detailsPanelVisible })),
  setDetailsPanelSize: (size) => set({ detailsPanelSize: size }),
  toggleFilterPanel: () =>
    set((state) => ({ filterPanelVisible: !state.filterPanelVisible })),
  setFilterPanelSize: (size) => set({ filterPanelSize: size }),
  setColumnVisibility: (vis) => {
    set({ columnVisibility: vis });
    debouncedPersistColumns(useUiStore.getState());
  },
  setColumnSizing: (sizing) => {
    set({ columnSizing: sizing });
    debouncedPersistColumns(useUiStore.getState());
  },
  setColumnOrder: (order) => {
    set({ columnOrder: order });
    debouncedPersistColumns(useUiStore.getState());
  },
  setTheme: (theme) => set({ theme }),
  setPollingInterval: (interval) => set({ pollingInterval: interval }),
  setRelativeDates: (value) => set({ relativeDates: value }),
  setConfirmOnAdd: (value) => set({ confirmOnAdd: value }),
  setSpeedPresets: (presets) => set({ speedPresets: presets }),
}));
