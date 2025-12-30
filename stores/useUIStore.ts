import { create } from 'zustand';

interface UIState {
  isSidebarOpen: boolean;
  isFilePanelOpen: boolean;
  isTreeOpen: boolean;
  isToolManagerOpen: boolean;

  toggleSidebar: () => void;
  toggleFilePanel: () => void;
  toggleTree: () => void;
  toggleToolManager: () => void;

  setSidebarOpen: (open: boolean) => void;
  setFilePanelOpen: (open: boolean) => void;
  setTreeOpen: (open: boolean) => void;
  setToolManagerOpen: (open: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isSidebarOpen: true,
  isFilePanelOpen: false,
  isTreeOpen: false,
  isToolManagerOpen: false,

  toggleSidebar: () => set((s) => ({ isSidebarOpen: !s.isSidebarOpen })),
  toggleFilePanel: () => set((s) => ({ isFilePanelOpen: !s.isFilePanelOpen })),
  toggleTree: () => set((s) => ({ isTreeOpen: !s.isTreeOpen })),
  toggleToolManager: () => set((s) => ({ isToolManagerOpen: !s.isToolManagerOpen })),

  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setFilePanelOpen: (open) => set({ isFilePanelOpen: open }),
  setTreeOpen: (open) => set({ isTreeOpen: open }),
  setToolManagerOpen: (open) => set({ isToolManagerOpen: open }),
}));