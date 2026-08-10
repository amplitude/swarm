import type { AgentType } from '../../types/agent';
import { Bot, Code2, ClipboardList, Palette, ListTodo } from 'lucide-react';

const AGENT_CONFIG: Record<AgentType, { icon: typeof Bot; label: string; accentClass: string }> = {
  manager: { icon: ListTodo, label: 'Manager', accentClass: 'text-primary-400' },
  general: { icon: Bot, label: 'General', accentClass: 'text-agent-general' },
  coder: { icon: Code2, label: 'Coder', accentClass: 'text-agent-coder' },
  pm: { icon: ClipboardList, label: 'PM', accentClass: 'text-agent-pm' },
  designer: { icon: Palette, label: 'Designer', accentClass: 'text-agent-designer' },
};

interface ThinkingIndicatorProps {
  agentType: AgentType;
}

export function ThinkingIndicator({ agentType }: ThinkingIndicatorProps) {
  const config = AGENT_CONFIG[agentType];
  const Icon = config.icon;

  return (
    <div className="flex gap-2.5 animate-fade-up">
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-overlay ${config.accentClass}`}>
        <Icon size={14} />
      </div>
      <div className="flex items-center gap-1.5 py-2">
        <span className={`h-1.5 w-1.5 rounded-full ${config.accentClass} animate-pulse-dot`} style={{ animationDelay: '0ms' }} />
        <span className={`h-1.5 w-1.5 rounded-full ${config.accentClass} animate-pulse-dot`} style={{ animationDelay: '300ms' }} />
        <span className={`h-1.5 w-1.5 rounded-full ${config.accentClass} animate-pulse-dot`} style={{ animationDelay: '600ms' }} />
      </div>
    </div>
  );
}
