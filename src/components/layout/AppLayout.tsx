import { type ReactNode, useEffect, useCallback } from 'react';
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
  const setRightPanelOpen = useAppStore((s) => s.setRightPanelOpen);

  // Auto-collapse sidebar and right panel on small viewports (< 640px)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)');
    if (mq.matches) {
      setSidebarOpen(false);
      setRightPanelOpen(false);
    }
    const handler = (e: MediaQueryListEvent) => {
      setSidebarOpen(!e.matches);
      if (!e.matches) setRightPanelOpen(false);
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [setSidebarOpen, setRightPanelOpen]);

  // Focus textarea after overlay close on mobile
  const focusTextarea = useCallback(() => {
    const ta = document.querySelector('textarea[placeholder*="Type a message"]') as HTMLTextAreaElement | null;
    if (ta) ta.focus();
  }, []);

  useEffect(() => {
    if (!sidebarOpen && !rightPanelOpen && typeof window !== 'undefined' && window.innerWidth < 640) {
      const id = setTimeout(focusTextarea, 150);
      return () => clearTimeout(id);
    }
  }, [sidebarOpen, rightPanelOpen, focusTextarea]);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface-inset">
      {/* Optional top bar (ModelStatus banner) — inside h-screen so height is accounted for */}
      {topBar}

      {/* Main area — row layout always; mobile panels render as fixed overlays */}
      <div className="flex flex-1 overflow-hidden">
        {/* Desktop sidebar (inline) or mobile toggle */}
        {sidebarOpen && (
          <div className="hidden sm:flex flex-shrink-0">
            <Sidebar />
          </div>
        )}

        {/* Panel toggle when sidebar is closed */}
        {!sidebarOpen && <PanelToggle side="left" />}

        {/* Main workspace */}
        <main className="flex flex-1 flex-col overflow-hidden">
          {main}
        </main>

        {/* Desktop right panel (inline) */}
        {rightPanelOpen && rightPanel && (
          <aside className="hidden sm:flex w-panel border-l border-border bg-surface overflow-hidden flex-col">
            {rightPanel}
          </aside>
        )}

        {/* Right panel toggle when panel is closed */}
        {!rightPanelOpen && <PanelToggle side="right" />}
      </div>

      {/* Mobile sidebar overlay drawer — backdrop uses outer onClick, content stops propagation */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-sidebar sm:hidden"
          onClick={() => setSidebarOpen(false)}
        >
          <div className="absolute inset-0 bg-overlay-backdrop" />
          <div
            className="absolute left-0 top-0 bottom-0 w-sidebar"
            onClick={(e) => e.stopPropagation()}
          >
            <Sidebar />
          </div>
        </div>
      )}

      {/* Mobile right panel overlay sheet */}
      {rightPanelOpen && rightPanel && (
        <div
          className="fixed inset-0 z-panel sm:hidden"
          onClick={() => setRightPanelOpen(false)}
        >
          <div className="absolute inset-0 bg-overlay-backdrop" />
          <div
            className="absolute right-0 top-0 bottom-0 w-panel max-sm:w-[85vw] bg-surface overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {rightPanel}
          </div>
        </div>
      )}

      {/* Status bar */}
      <StatusBar />
    </div>
  );
}
