import { type ReactNode, useEffect } from 'react';
import { useAppStore } from '../../store/app-store';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { PanelToggle } from './PanelToggle';

interface AppLayoutProps {
  main: ReactNode;
  rightPanel?: ReactNode;
  /** Optional banner/status bar rendered at top of the flex column (e.g. ModelStatus) */
  topBar?: ReactNode;
}

export function AppLayout({ main, rightPanel, topBar }: AppLayoutProps) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);

  // Auto-collapse sidebar on small viewports (< 640px)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    if (mq.matches) {
      setSidebarOpen(false);
    }
    const handler = (e: MediaQueryListEvent) => setSidebarOpen(!e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [setSidebarOpen]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface-inset">
      {/* Optional top bar (ModelStatus banner) — inside h-screen so height is accounted for */}
      {topBar}

      {/* Main area */}
      <div className="flex flex-1 overflow-hidden max-sm:flex-col">
        {/* Sidebar */}
        <Sidebar />

        {/* Sidebar collapse toggle when sidebar is closed */}
        {!sidebarOpen && <PanelToggle side="left" />}

        {/* Main workspace */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {main}
        </main>

        {/* Right panel */}
        {rightPanelOpen && rightPanel && (
          <aside className="w-panel border-l border-border bg-surface overflow-hidden flex flex-col">
            {rightPanel}
          </aside>
        )}

        {/* Right panel toggle when panel is closed */}
        {!rightPanelOpen && <PanelToggle side="right" />}
      </div>

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
