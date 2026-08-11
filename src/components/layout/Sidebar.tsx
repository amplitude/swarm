import { useAppStore, switchAgent, switchSession } from '../../store/app-store';
import type { AgentType } from '../../types/agent';
import {
  MessageSquare,
  Plus,
  Settings,
  Sun,
  Moon,
  Briefcase,
  Code2,
  ClipboardList,
  Palette,
  Bot,
  Trash2,
  FolderOpen,
} from 'lucide-react';

const AGENTS: { id: AgentType; name: string; icon: typeof Bot; color: string }[] = [
  { id: 'manager', name: 'Manager', icon: Briefcase, color: 'bg-primary-500/20 text-primary-400' },
  { id: 'general', name: 'General', icon: Bot, color: 'bg-agent-general/20 text-agent-general' },
  { id: 'coder', name: 'Coder', icon: Code2, color: 'bg-agent-coder/20 text-agent-coder' },
  { id: 'pm', name: 'PM', icon: ClipboardList, color: 'bg-agent-pm/20 text-agent-pm' },
  { id: 'designer', name: 'Designer', icon: Palette, color: 'bg-agent-designer/20 text-agent-designer' },
];

export function Sidebar() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen);
  const activeAgent = useAppStore((s) => s.activeAgent);
  const theme = useAppStore((s) => s.theme);
  const toggleTheme = useAppStore((s) => s.toggleTheme);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const conversations = useAppStore((s) => s.conversations);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const setActiveConversation = useAppStore((s) => s.setActiveConversation);
  const createConversation = useAppStore((s) => s.createConversation);
  const deleteConversation = useAppStore((s) => s.deleteConversation);
  const sessions = useAppStore((s) => s.sessions);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const createSession = useAppStore((s) => s.createSession);
  const deleteSession = useAppStore((s) => s.deleteSession);
  const renameSession = useAppStore((s) => s.renameSession);
  const getConversationsBySession = useAppStore((s) => s.getConversationsBySession);

  if (!sidebarOpen) return null;

  const activeSession = sessions.find((s) => s.id === activeSessionId);

  // Conversations filtered by active session AND active agent
  const sessionConversations = activeSessionId
    ? getConversationsBySession(activeSessionId)
    : conversations;
  const agentConversations = sessionConversations.filter(
    (c) => c.activeAgent === activeAgent,
  );

  return (
    <aside className="flex h-full w-sidebar flex-col border-r border-border bg-surface">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="h-6 w-6 rounded-md bg-primary-500 flex items-center justify-center">
          <Bot size={14} className="text-text-inverse" />
        </div>
        <span className="text-sm font-semibold text-text-primary tracking-tight">Swarm</span>
        {activeSession && (
          <span className="ml-auto text-2xs text-text-tertiary truncate max-w-[100px]">
            {activeSession.name}
          </span>
        )}
      </div>

      {/* Sessions */}
      <div className="px-3 pt-3 pb-1">
        <span className="px-1 text-2xs font-medium uppercase tracking-wide text-text-tertiary">
          Sessions
        </span>
      </div>
      <div className="flex flex-col gap-0.5 px-2">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={`group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm cursor-pointer transition-colors ${
              activeSessionId === session.id
                ? 'bg-surface-overlay text-text-primary'
                : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
            }`}
            onClick={() => switchSession(session.id)}
          >
            <FolderOpen size={13} className="shrink-0 text-text-tertiary" />
            <span className="truncate font-medium">{session.name}</span>
            {activeSessionId === session.id && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  const name = prompt('Session name:', session.name);
                  if (name && name.trim()) {
                    renameSession(session.id, name.trim());
                  }
                }}
                className="ml-auto hidden shrink-0 rounded p-0.5 text-text-tertiary hover:bg-surface-raised group-hover:block"
                title="Rename"
              >
                <span className="text-2xs">✎</span>
              </button>
            )}
            {sessions.length > 1 && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (window.confirm(`Delete session "${session.name}" and all its conversations?`)) {
                    deleteSession(session.id);
                  }
                }}
                className="ml-auto hidden shrink-0 rounded p-0.5 text-text-tertiary hover:bg-danger-500/20 hover:text-danger-400 group-hover:block"
                title="Delete session"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => createSession()}
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
        >
          <Plus size={12} />
          New session
        </button>
      </div>

      {/* Agent List */}
      <div className="px-3 pt-3 pb-1">
        <span className="px-1 text-2xs font-medium uppercase tracking-wide text-text-tertiary">
          Agents
        </span>
      </div>
      <div className="flex flex-col gap-0.5 px-2">
        {AGENTS.map((agent, idx) => {
          const Icon = agent.icon;
          const isActive = activeAgent === agent.id;
          return (
            <button
              key={agent.id}
              onClick={() => switchAgent(agent.id)}
              title={`${agent.name} (Cmd+${idx + 1})`}
              className={`flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors ${
                isActive
                  ? 'bg-surface-overlay text-text-primary'
                  : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
              }`}
            >
              <span className={`flex h-6 w-6 items-center justify-center rounded-md ${agent.color}`}>
                <Icon size={13} />
              </span>
              <span className="font-medium">{agent.name}</span>
              {isActive && (
                <span className="ml-auto h-1.5 w-1.5 rounded-full bg-success-400" />
              )}
            </button>
          );
        })}
      </div>

      {/* Conversations */}
      <div className="mt-4 flex items-center justify-between px-3 pb-1">
        <span className="px-1 text-2xs font-medium uppercase tracking-wide text-text-tertiary">
          Conversations
        </span>
        <button
          onClick={() => createConversation(undefined, activeAgent, activeSessionId || undefined)}
          className="rounded-md p-1 text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
          title="New conversation"
        >
          <Plus size={14} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-2">
        {agentConversations.length === 0 ? (
          <p className="px-2.5 py-4 text-xs text-text-tertiary">No conversations yet</p>
        ) : (
          <div className="flex flex-col gap-0.5">
            {agentConversations.map((conv) => (
              <div
                key={conv.id}
                className={`group flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm cursor-pointer transition-colors ${
                  activeConversationId === conv.id
                    ? 'bg-surface-overlay text-text-primary'
                    : 'text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                }`}
                onClick={() => setActiveConversation(conv.id)}
              >
                <MessageSquare size={13} className="shrink-0 text-text-tertiary" />
                <span className="truncate font-medium">{conv.title}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm('Delete this conversation?')) {
                      deleteConversation(conv.id);
                    }
                  }}
                  className="ml-auto hidden shrink-0 rounded p-0.5 text-text-tertiary hover:bg-danger-500/20 hover:text-danger-400 group-hover:block"
                  title="Delete conversation"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center gap-1 border-t border-border px-3 py-2">
        <button
          onClick={toggleTheme}
          className="flex items-center justify-center rounded-md min-w-[32px] min-h-[32px] p-2 text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
        </button>
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center justify-center rounded-md min-w-[32px] min-h-[32px] p-2 text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
          title="Settings"
        >
          <Settings size={15} />
        </button>
      </div>
    </aside>
  );
}
