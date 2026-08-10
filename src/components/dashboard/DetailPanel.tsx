import type { AgentType } from '../../types/agent';
import { useAppStore } from '../../store/app-store';
import { MessageList } from '../chat/MessageList';
import { ChatInput } from '../chat/ChatInput';
import { X, Bot, Briefcase, Code2, ClipboardList, Palette } from 'lucide-react';

const AGENT_META: Record<AgentType, { icon: typeof Bot; label: string; badgeBg: string; badgeText: string; badgeBorder: string }> = {
  manager: { icon: Briefcase, label: 'Manager', badgeBg: 'bg-primary-500/15', badgeText: 'text-primary-400', badgeBorder: 'border-primary-400/20' },
  coder: { icon: Code2, label: 'Coder', badgeBg: 'bg-agent-coder-muted', badgeText: 'text-agent-coder', badgeBorder: 'border-agent-coder/20' },
  pm: { icon: ClipboardList, label: 'PM', badgeBg: 'bg-agent-pm-muted', badgeText: 'text-agent-pm', badgeBorder: 'border-agent-pm/20' },
  designer: { icon: Palette, label: 'Designer', badgeBg: 'bg-agent-designer-muted', badgeText: 'text-agent-designer', badgeBorder: 'border-agent-designer/20' },
  general: { icon: Bot, label: 'General', badgeBg: 'bg-agent-general-muted', badgeText: 'text-agent-general', badgeBorder: 'border-agent-general/20' },
};

interface DetailPanelProps {
  agentId: AgentType;
  onClose: () => void;
}

export function DetailPanel({ agentId, onClose }: DetailPanelProps) {
  const meta = AGENT_META[agentId];
  const Icon = meta.icon;
  const agentState = useAppStore((s) => s.agentState[agentId]);

  const statusLabel = agentState.isThinking
    ? 'Thinking'
    : agentState.currentIteration > 0
      ? 'Working'
      : 'Idle';

  const dotClass = agentState.isThinking
    ? 'w-2 h-2 rounded-full bg-warning-400 animate-pulse-dot'
    : agentState.currentIteration > 0
      ? 'w-2 h-2 rounded-full bg-success-400'
      : 'w-2 h-2 rounded-full bg-gray-500';

  return (
    <div className="w-[400px] shrink-0 border-l border-border-subtle bg-surface flex flex-col overflow-hidden animate-slide-in-right xl:w-[400px] 2xl:w-[560px] max-xl:fixed max-xl:right-0 max-xl:top-0 max-xl:bottom-0 max-xl:z-50 max-xl:shadow-xl max-md:w-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle shrink-0">
        <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${meta.badgeBg} ${meta.badgeText} ${meta.badgeBorder}`}>
          <Icon size={16} />
        </span>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-text-primary">{meta.label} Agent</span>
            <span className={dotClass} />
            <span className="text-2xs text-text-tertiary">{statusLabel}</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1.5 text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Chat thread */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <MessageList />
        <ChatInput />
      </div>
    </div>
  );
}
