import { useAppStore } from '../../store/app-store';
import { PanelLeft, PanelRight } from 'lucide-react';
import type { AgentType } from '../../types/agent';

const AGENT_LABELS: Record<AgentType, { label: string; colorClass: string }> = {
  manager: { label: 'Manager', colorClass: 'bg-primary-400' },
  general: { label: 'General', colorClass: 'bg-agent-general' },
  coder: { label: 'Coder', colorClass: 'bg-agent-coder' },
  pm: { label: 'PM', colorClass: 'bg-agent-pm' },
  designer: { label: 'Designer', colorClass: 'bg-agent-designer' },
};

export function Header() {
  const activeAgent = useAppStore((s) => s.activeAgent);
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const rightPanelOpen = useAppStore((s) => s.rightPanelOpen);
  const toggleRightPanel = useAppStore((s) => s.toggleRightPanel);
  const agentInfo = AGENT_LABELS[activeAgent];

  return (
    <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-surface px-3">
      {/* Sidebar toggle */}
      <button
        onClick={toggleSidebar}
        className="rounded-md p-1.5 text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        <PanelLeft size={16} />
      </button>

      {/* Active agent badge */}
      <div className="flex items-center gap-2">
        <span className={`h-2 w-2 rounded-full ${agentInfo.colorClass}`} />
        <span className="text-sm font-medium text-text-primary">{agentInfo.label} Agent</span>
      </div>

      <div className="flex-1" />

      <span className="text-xs text-text-tertiary select-none">v{__APP_VERSION__}</span>

      {/* Right panel toggle */}
      <button
        onClick={toggleRightPanel}
        className="rounded-md p-1.5 text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
        title={rightPanelOpen ? 'Close panel' : 'Open panel'}
      >
        <PanelRight size={16} />
      </button>
    </header>
  );
}
