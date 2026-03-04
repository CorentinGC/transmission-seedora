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

  // Actions
  toggleDetailsPanel: () => void;
  setDetailsPanelSize: (size: number) => void;
  toggleFilterPanel: () => void;
  setFilterPanelSize: (size: number) => void;
  setColumnVisibility: (vis: Record<string, boolean>) => void;
  setColumnSizing: (sizing: Record<string, number>) => void;
  setColumnOrder: (order: string[]) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
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
}));
