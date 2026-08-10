import type { StateCreator } from 'zustand';
import type { Artifact } from '../../types/tool';

export type ActivePanel = 'chat' | 'canvas' | 'preview';
export type Theme = 'dark' | 'light';
export type ViewMode = 'dashboard' | 'chat';

export interface UISlice {
  sidebarOpen: boolean;
  rightPanelOpen: boolean;
  activePanel: ActivePanel;
  theme: Theme;
  settingsOpen: boolean;
  viewMode: ViewMode;
  selectedArtifact: Artifact | null;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleRightPanel: () => void;
  setRightPanelOpen: (open: boolean) => void;
  setActivePanel: (panel: ActivePanel) => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSettingsOpen: (open: boolean) => void;
  setViewMode: (mode: ViewMode) => void;
  openArtifact: (artifact: Artifact) => void;
  closeArtifact: () => void;
}

const getInitialTheme = (): Theme => {
  if (typeof window === 'undefined') return 'dark';
  const stored = localStorage.getItem('swarm-theme');
  if (stored === 'light' || stored === 'dark') return stored;
  // Detect system preference via matchMedia
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
};

export const createUISlice: StateCreator<UISlice, [], [], UISlice> = (set) => ({
  sidebarOpen: true,
  rightPanelOpen: false,
  activePanel: 'chat',
  theme: getInitialTheme(),
  settingsOpen: false,
  viewMode: 'dashboard',
  selectedArtifact: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleRightPanel: () => set((s) => ({ rightPanelOpen: !s.rightPanelOpen })),
  setRightPanelOpen: (open) => set({ rightPanelOpen: open }),
  setActivePanel: (panel) => set({ activePanel: panel }),
  setTheme: (theme) => {
    localStorage.setItem('swarm-theme', theme);
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },
  toggleTheme: () =>
    set((s) => {
      const next = s.theme === 'dark' ? 'light' : 'dark';
      localStorage.setItem('swarm-theme', next);
      document.documentElement.classList.toggle('light', next === 'light');
      document.documentElement.classList.toggle('dark', next === 'dark');
      return { theme: next };
    }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setViewMode: (mode) => set({ viewMode: mode }),
  openArtifact: (artifact) => set({ selectedArtifact: artifact, rightPanelOpen: true }),
  closeArtifact: () => set({ selectedArtifact: null, rightPanelOpen: false }),
});
