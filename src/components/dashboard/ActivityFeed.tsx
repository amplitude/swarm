import type { AgentType } from '../../types/agent';

export interface FeedItem {
  id: string;
  agentId: AgentType;
  action: string;
  detail?: string;
  timestamp: number;
}

const AGENT_DOT_COLORS: Record<AgentType, string> = {
  manager: 'bg-primary-400',
  coder: 'bg-agent-coder',
  pm: 'bg-agent-pm',
  designer: 'bg-agent-designer',
  general: 'bg-agent-general',
};

const AGENT_NAMES: Record<AgentType, string> = {
  manager: 'Manager',
  coder: 'Coder',
  pm: 'PM',
  designer: 'Designer',
  general: 'General',
};

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 1000) return 'just now';
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  return `${Math.floor(diff / 3_600_000)}h ago`;
}

interface ActivityFeedProps {
  items: FeedItem[];
}

export function ActivityFeed({ items }: ActivityFeedProps) {
  return (
    <div className="bg-surface-raised border border-border-subtle rounded-lg mt-4 overflow-y-auto max-h-[200px]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle text-sm font-medium text-text-secondary">
        <span>Activity</span>
        <span className="text-2xs text-text-tertiary">{items.length} events</span>
      </div>
      {items.length === 0 ? (
        <p className="px-4 py-6 text-center text-xs text-text-tertiary">No activity yet</p>
      ) : (
        items.map((item) => (
          <div key={item.id} className="flex items-start gap-3 px-4 py-2.5 text-sm border-b border-border-subtle last:border-b-0 animate-fade-up">
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${AGENT_DOT_COLORS[item.agentId]}`} />
            <span className="font-medium text-text-primary whitespace-nowrap">{AGENT_NAMES[item.agentId]}</span>
            <span className="text-text-secondary flex-1 truncate">{item.action}</span>
            <span className="text-text-tertiary text-xs whitespace-nowrap">{relativeTime(item.timestamp)}</span>
          </div>
        ))
      )}
    </div>
  );
}
