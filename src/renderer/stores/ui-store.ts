import { create } from 'zustand';

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

  // Actions
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

  toggleDetailsPanel: () =>
    set((state) => ({ detailsPanelVisible: !state.detailsPanelVisible })),
  setDetailsPanelSize: (size) => set({ detailsPanelSize: size }),
  toggleFilterPanel: () =>
    set((state) => ({ filterPanelVisible: !state.filterPanelVisible })),
  setFilterPanelSize: (size) => set({ filterPanelSize: size }),
  setColumnVisibility: (vis) => set({ columnVisibility: vis }),
  setColumnSizing: (sizing) => set({ columnSizing: sizing }),
  setColumnOrder: (order) => set({ columnOrder: order }),
  setTheme: (theme) => set({ theme }),
  setPollingInterval: (interval) => set({ pollingInterval: interval }),
  setRelativeDates: (value) => set({ relativeDates: value }),
  setConfirmOnAdd: (value) => set({ confirmOnAdd: value }),
}));
