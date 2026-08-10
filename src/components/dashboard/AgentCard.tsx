import type { AgentType, AgentRuntimeState } from '../../types/agent';
import { Bot, Briefcase, Code2, ClipboardList, Palette, Wrench, Zap } from 'lucide-react';

const AGENT_META: Record<AgentType, { icon: typeof Bot; label: string; borderColor: string; activeGlow: string }> = {
  manager: { icon: Briefcase, label: 'Manager', borderColor: 'border-l-primary-400', activeGlow: 'shadow-glow-primary' },
  coder: { icon: Code2, label: 'Coder', borderColor: 'border-l-agent-coder', activeGlow: 'shadow-glow-coder' },
  pm: { icon: ClipboardList, label: 'PM', borderColor: 'border-l-agent-pm', activeGlow: 'shadow-glow-pm' },
  designer: { icon: Palette, label: 'Designer', borderColor: 'border-l-agent-designer', activeGlow: 'shadow-glow-designer' },
  general: { icon: Bot, label: 'General', borderColor: 'border-l-agent-general', activeGlow: 'shadow-glow-general' },
};

const PROGRESS_COLORS: Record<AgentType, string> = {
  manager: 'bg-primary-400',
  coder: 'bg-agent-coder',
  pm: 'bg-agent-pm',
  designer: 'bg-agent-designer',
  general: 'bg-agent-general',
};

interface AgentCardProps {
  agentId: AgentType;
  state: AgentRuntimeState;
  isSelected: boolean;
  lastMessage?: string;
  toolCount: number;
  tokenCount: number;
  maxTokens: number;
  onClick: () => void;
}

export function AgentCard({
  agentId,
  state,
  isSelected,
  lastMessage,
  toolCount,
  tokenCount,
  maxTokens,
  onClick,
}: AgentCardProps) {
  const meta = AGENT_META[agentId];
  const Icon = meta.icon;

  const statusLabel = state.isThinking
    ? 'Thinking...'
    : state.currentIteration > 0
      ? `Working (${state.currentIteration} iterations)`
      : 'Idle';

  const dotClass = state.isThinking
    ? 'w-2 h-2 rounded-full bg-warning-400 animate-pulse-dot'
    : state.currentIteration > 0
      ? 'w-2 h-2 rounded-full bg-success-400'
      : 'w-2 h-2 rounded-full bg-gray-500';

  const isWorking = state.isThinking || state.currentIteration > 0;
  const borderLeft = isWorking ? meta.borderColor : 'border-l-transparent';

  return (
    <div
      onClick={onClick}
      className={`bg-surface-raised border border-border-subtle rounded-lg p-4 transition-all duration-200 hover:border-border-strong cursor-pointer border-l-2 min-w-[200px] max-md:min-w-0 ${borderLeft} ${state.isThinking ? 'animate-pulse-dot' : ''} ${isSelected ? `bg-surface-overlay border-border-strong ${meta.activeGlow}` : ''}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={16} className="text-text-secondary" />
          <span className="text-sm font-semibold text-text-primary">{meta.label}</span>
        </div>
        <span className={dotClass} />
      </div>

      {/* Status / last message */}
      <p className="text-xs text-text-secondary line-clamp-2 mb-3 min-h-[2rem] break-words">
        {lastMessage || statusLabel}
      </p>

      {/* Progress bar if working */}
      {state.currentIteration > 0 && (
        <div className="h-1.5 w-full rounded-full bg-surface-inset overflow-hidden mb-3">
          <div
            className={`h-full rounded-full transition-all duration-300 ease-out ${PROGRESS_COLORS[agentId]}`}
            style={{ width: `${Math.min((state.currentIteration / 8) * 100, 100)}%` }}
          />
        </div>
      )}

      {/* Thinking shimmer */}
      {state.isThinking && state.currentIteration === 0 && (
        <div className="thinking-shimmer h-1.5 rounded-full mb-3" />
      )}

      {/* Footer metrics — wraps on narrow panels */}
      <div className="flex items-center gap-x-4 gap-y-1 pt-2 border-t border-border-subtle flex-wrap">
        <span className="inline-flex items-center gap-1 text-2xs text-text-tertiary font-mono truncate max-w-full">
          <Wrench size={10} className="shrink-0" /> {toolCount} active
        </span>
        <span className="inline-flex items-center gap-1 text-2xs text-text-tertiary font-mono truncate max-w-full">
          <Zap size={10} className="shrink-0" /> {tokenCount}/{maxTokens}
        </span>
      </div>
    </div>
  );
}
