import { type ReactNode } from 'react';
import { useAppStore } from '../../store/app-store';
import { Sidebar } from './Sidebar';
import { StatusBar } from './StatusBar';
import { PanelToggle } from './PanelToggle';

interface AppLayoutProps {
  main: ReactNode;
  rightPanel?: ReactNode;
}

export function AppLayout({ main, rightPanel }: AppLayoutProps) {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-surface-inset">
      {/* Main area */}
      <div className="flex flex-1 overflow-hidden">
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
