import { useState, useMemo, useEffect } from 'react';
import { useAppStore, switchAgent } from '../../store/app-store';
import { AgentCard } from './AgentCard';
import { ActivityFeed, type FeedItem } from './ActivityFeed';
import { DetailPanel } from './DetailPanel';
import { WorkspacePanel } from '../artifacts/WorkspacePanel';
import { DecisionBadge } from './DecisionBadge';
import { MessageList } from '../chat/MessageList';
import { ChatInput } from '../chat/ChatInput';
import type { AgentType } from '../../types/agent';
import { Bot, Settings, Cpu, Briefcase } from 'lucide-react';

const SPECIALIST_IDS: AgentType[] = ['coder', 'pm', 'designer', 'general'];

export function MissionControl() {
  const agentState = useAppStore((s) => s.agentState);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const llmModelName = useAppStore((s) => s.llmModelName);
  const llmStatus = useAppStore((s) => s.llmStatus);
  const conversations = useAppStore((s) => s.conversations);
  const activeAgent = useAppStore((s) => s.activeAgent);
  const [selectedSpecialist, setSelectedSpecialist] = useState<AgentType | null>(null);

  // Ensure manager is always the active agent on mount and when detail panel closes
  useEffect(() => {
    if (!selectedSpecialist && activeAgent !== 'manager') {
      switchAgent('manager');
    }
  }, [selectedSpecialist, activeAgent]);

  // On first mount, ensure manager is active
  useEffect(() => {
    switchAgent('manager');
  }, []);

  const feedItems = useMemo(() => {
    const items: FeedItem[] = [];
    for (const conv of conversations) {
      for (const msg of conv.messages) {
        const agentId = msg.agentType ?? conv.activeAgent ?? 'general';
        if (msg.role === 'user') {
          items.push({
            id: msg.id,
            agentId,
            action: 'received message',
            detail: msg.content.slice(0, 80),
            timestamp: msg.timestamp,
          });
        } else if (msg.role === 'assistant') {
          items.push({
            id: msg.id,
            agentId,
            action: 'replied',
            detail: msg.content.slice(0, 80),
            timestamp: msg.timestamp,
          });
        } else if (msg.role === 'tool') {
          const toolId = msg.toolCall?.toolId ?? 'tool';
          items.push({
            id: msg.id,
            agentId,
            action: `called ${toolId}`,
            detail: msg.toolResult?.success ? 'success' : msg.toolResult?.error?.slice(0, 60),
            timestamp: msg.timestamp,
          });
        }
      }
    }
    items.sort((a, b) => b.timestamp - a.timestamp);
    return items.slice(0, 50);
  }, [conversations]);

  const handleSpecialistClick = (agentId: AgentType) => {
    setSelectedSpecialist(agentId);
    switchAgent(agentId);
  };

  const handleDetailClose = () => {
    setSelectedSpecialist(null);
    switchAgent('manager');
  };

  const managerState = agentState.manager;
  const managerStatusLabel = managerState.isThinking
    ? 'Thinking'
    : managerState.currentIteration > 0
      ? 'Working'
      : 'Online';

  const managerDotClass = managerState.isThinking
    ? 'w-2 h-2 rounded-full bg-warning-400 animate-pulse-dot'
    : managerState.currentIteration > 0
      ? 'w-2 h-2 rounded-full bg-success-400'
      : 'w-2 h-2 rounded-full bg-success-400';

  const statusColor =
    llmStatus === 'ready'
      ? 'text-success-400'
      : llmStatus === 'loading'
        ? 'text-info-400'
        : llmStatus === 'error'
          ? 'text-danger-400'
          : 'text-text-tertiary';

  return (
    <div className="flex h-screen flex-col bg-surface-inset">
      {/* Top bar */}
      <header className="flex h-11 shrink-0 items-center justify-between border-b border-border bg-surface px-4">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-primary-500 flex items-center justify-center">
            <Bot size={14} className="text-white" />
          </div>
          <span className="text-sm font-semibold text-text-primary tracking-tight">Swarm</span>
          <span className="text-2xs text-text-tertiary ml-1">v0.1.0</span>
        </div>
        <div className="flex items-center gap-3">
          <span className={`flex items-center gap-1.5 text-2xs ${statusColor}`}>
            <Cpu size={11} />
            {llmModelName || 'No model'}
          </span>
          <button
            onClick={() => setSettingsOpen(true)}
            className="flex items-center justify-center rounded-md min-w-[32px] min-h-[32px] p-1.5 text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
          >
            <Settings size={16} />
          </button>
        </div>
      </header>

      {/* Main split layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Manager Chat (60-65%) */}
        <div className="flex flex-col w-[63%] min-w-0 border-r border-border-subtle">
          {/* Manager header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border-subtle bg-surface shrink-0">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg border bg-primary-500/15 text-primary-400 border-primary-400/20">
              <Briefcase size={16} />
            </span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-text-primary">Manager</span>
                <span className={managerDotClass} />
                <span className="text-2xs text-text-tertiary">{managerStatusLabel}</span>
                <DecisionBadge />
              </div>
              <p className="text-2xs text-text-tertiary">Primary team coordinator</p>
            </div>
          </div>

          {/* Manager messages */}
          <div className="flex flex-1 flex-col overflow-hidden">
            <MessageList />
            <ManagerChatInput />
          </div>
        </div>

        {/* RIGHT: Side Panel (35-40%) */}
        <div className="flex flex-col w-[37%] min-w-0 overflow-y-auto overflow-x-hidden bg-surface-inset">
          {/* Specialist Agent Cards */}
          <div className="p-4 pb-2">
            <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider mb-3">Specialist Agents</h3>
            <div className="grid grid-cols-2 max-sm:grid-cols-1 gap-2">
              {SPECIALIST_IDS.map((agentId) => (
                <AgentCard
                  key={agentId}
                  agentId={agentId}
                  state={agentState[agentId]}
                  isSelected={selectedSpecialist === agentId}
                  toolCount={0}
                  tokenCount={0}
                  maxTokens={4096}
                  onClick={() => handleSpecialistClick(agentId)}
                />
              ))}
            </div>
          </div>

          {/* Activity Feed */}
          <div className="px-4 pb-2">
            <ActivityFeed items={feedItems} />
          </div>

          {/* Workspace / Artifacts */}
          <div className="px-4 pb-4">
            <WorkspacePanel />
          </div>
        </div>

        {/* Specialist Detail Panel (overlay) */}
        {selectedSpecialist && (
          <DetailPanel
            agentId={selectedSpecialist}
            onClose={handleDetailClose}
          />
        )}
      </div>

      {/* Status bar */}
      <footer className="flex h-7 shrink-0 items-center justify-between border-t border-border bg-surface px-4">
        <span className={`flex items-center gap-1.5 text-2xs ${statusColor}`}>
          <Cpu size={10} />
          {llmModelName || 'No model loaded'}
        </span>
        <span className="text-2xs text-text-tertiary">
          {llmStatus === 'ready' ? 'Ready' : llmStatus === 'loading' ? 'Loading...' : llmStatus === 'generating' ? 'Generating...' : llmStatus}
        </span>
      </footer>
    </div>
  );
}

/**
 * Specialized ChatInput for the Manager — larger, distinct placeholder.
 * This is a thin wrapper that ensures the store's activeAgent is 'manager'.
 */
function ManagerChatInput() {
  return <ChatInput placeholderOverride="Talk to your team..." variant="manager" />;
}
