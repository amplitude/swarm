import { useState } from 'react';
import { useAppStore, switchAgent } from '../../store/app-store';
import type { AgentType } from '../../types/agent';

import {
  Bot, Code2, ClipboardList, Palette, Briefcase,
  Plus, Trash2, CheckCircle2, Circle, ArrowRight,
  ChevronDown, ChevronUp, ListTodo,
} from 'lucide-react';

const AGENT_CONFIG: Record<AgentType, { icon: typeof Bot; name: string; colorClass: string }> = {
  manager: { icon: Briefcase, name: 'Manager', colorClass: 'text-primary-400' },
  general: { icon: Bot, name: 'General', colorClass: 'text-agent-general' },
  coder: { icon: Code2, name: 'Coder', colorClass: 'text-agent-coder' },
  pm: { icon: ClipboardList, name: 'PM', colorClass: 'text-agent-pm' },
  designer: { icon: Palette, name: 'Designer', colorClass: 'text-agent-designer' },
};

export function InspectorPanel() {
  const activeAgent = useAppStore((s) => s.activeAgent);
  const agentState = useAppStore((s) => s.agentState);
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const activeSessionId = useAppStore((s) => s.activeSessionId);
  const tasks = useAppStore((s) => s.tasks);
  const addTask = useAppStore((s) => s.addTask);
  const updateTaskStatus = useAppStore((s) => s.updateTaskStatus);
  const deleteTask = useAppStore((s) => s.deleteTask);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);

  const [agentExpanded, setAgentExpanded] = useState(true);
  const [tasksExpanded, setTasksExpanded] = useState(true);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [showNewTask, setShowNewTask] = useState(false);

  const currentAgent = AGENT_CONFIG[activeAgent];
  const AgentIcon = currentAgent.icon;
  const state = agentState[activeAgent];
  const isThinking = state.isThinking;

  // Tasks for current conversation
  const conversationTasks = tasks.filter((t) => t.conversationId === activeConversationId);
  const pendingTasks = conversationTasks.filter((t) => t.status === 'pending' || t.status === 'in_progress');
  const completedTasks = conversationTasks.filter((t) => t.status === 'completed');

  const handleAddTask = () => {
    const title = newTaskTitle.trim();
    if (!title || !activeConversationId) return;
    addTask(activeSessionId || 'default', activeConversationId, title, '', 'medium', activeAgent);
    setNewTaskTitle('');
    setShowNewTask(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleAddTask();
    }
    if (e.key === 'Escape') {
      setShowNewTask(false);
      setNewTaskTitle('');
    }
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Agents section */}
      <div className="border-b border-border">
        <button
          onClick={() => setAgentExpanded((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-text-secondary hover:bg-surface-raised transition-colors"
        >
          {agentExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          <ListTodo size={12} />
          Agent
          <span className="ml-auto text-2xs text-text-tertiary">{currentAgent.name}</span>
        </button>
        {agentExpanded && (
          <div className="px-3 pb-3">
            {/* Current agent */}
            <div className="rounded-lg border border-border bg-surface-raised px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className={`flex h-6 w-6 items-center justify-center rounded-md bg-surface-overlay ${currentAgent.colorClass}`}>
                  <AgentIcon size={12} />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-medium text-text-primary">{currentAgent.name}</span>
                    <span className={`h-1.5 w-1.5 rounded-full ${isThinking ? 'bg-warning-400 animate-pulse-dot' : 'bg-success-400'}`} />
                  </div>
                  <span className="text-2xs text-text-tertiary">
                    {isThinking ? 'Thinking...' : 'Ready'}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick agent switch */}
            <div className="mt-2 flex flex-wrap gap-1">
              {(Object.keys(AGENT_CONFIG) as AgentType[])
                .filter((a) => a !== activeAgent)
                .map((agentId) => {
                  const agent = AGENT_CONFIG[agentId];
                  const AIcon = agent.icon;
                  return (
                    <button
                      key={agentId}
                      onClick={() => switchAgent(agentId)}
                      className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-medium border border-border bg-surface-raised ${agent.colorClass} hover:bg-surface-overlay transition-colors`}
                    >
                      <AIcon size={10} />
                      {agent.name}
                      <ArrowRight size={10} className="opacity-50" />
                    </button>
                  );
                })}
            </div>

            {/* Agent settings */}
            <button
              onClick={() => setSettingsOpen(true)}
              className="mt-2 w-full flex items-center justify-center gap-1 rounded-md px-2 py-1.5 text-2xs text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
            >
              Agent settings
            </button>
          </div>
        )}
      </div>

      {/* Tasks section */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <button
          onClick={() => setTasksExpanded((v) => !v)}
          className="flex w-full items-center gap-2 px-3 py-2.5 text-xs font-medium text-text-secondary hover:bg-surface-raised transition-colors"
        >
          {tasksExpanded ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          <ListTodo size={12} />
          Tasks
          <span className="ml-auto text-2xs text-text-tertiary">{pendingTasks.length} pending</span>
        </button>
        {tasksExpanded && (
          <div className="flex-1 overflow-y-auto px-3 pb-3">
            {/* New task input */}
            {showNewTask ? (
              <div className="mb-2 flex items-center gap-1.5">
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Task title..."
                  className="flex-1 rounded-md border border-border bg-surface-inset px-2 py-1.5 text-xs text-text-primary outline-none focus:border-primary-500/50"
                  autoFocus
                />
                <button
                  onClick={handleAddTask}
                  disabled={!newTaskTitle.trim()}
                  className="rounded-md bg-primary-600 px-2 py-1.5 text-2xs text-text-inverse hover:bg-primary-500 disabled:opacity-30 transition-colors"
                >
                  Add
                </button>
                <button
                  onClick={() => {
                    setShowNewTask(false);
                    setNewTaskTitle('');
                  }}
                  className="rounded-md px-2 py-1.5 text-2xs text-text-tertiary hover:bg-surface-raised transition-colors"
                >
                  Esc
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowNewTask(true)}
                className="mb-2 w-full flex items-center gap-1.5 rounded-md border border-dashed border-border px-2.5 py-1.5 text-2xs text-text-tertiary hover:border-solid hover:bg-surface-raised hover:text-text-secondary transition-colors"
              >
                <Plus size={10} />
                Add task
              </button>
            )}

            {/* Pending tasks */}
            {pendingTasks.length === 0 && completedTasks.length === 0 && (
              <p className="text-2xs text-text-tertiary py-4 text-center">No tasks yet</p>
            )}
            {pendingTasks.map((task) => (
              <div
                key={task.id}
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-surface-raised transition-colors"
              >
                <button
                  onClick={() => updateTaskStatus(task.id, 'completed')}
                  className="mt-0.5 shrink-0 text-text-tertiary hover:text-success-400 transition-colors"
                >
                  <Circle size={12} />
                </button>
                <div className="flex-1 min-w-0">
                  <span className="text-xs text-text-primary">{task.title}</span>
                  {task.description && (
                    <p className="text-2xs text-text-tertiary truncate">{task.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {task.assignedAgent && (
                    <span className={`text-2xs ${AGENT_CONFIG[task.assignedAgent]?.colorClass || 'text-text-tertiary'}`}>
                      {AGENT_CONFIG[task.assignedAgent]?.name?.[0] || '?'}
                    </span>
                  )}
                  <button
                    onClick={() => deleteTask(task.id)}
                    className="shrink-0 text-text-tertiary hover:text-danger-400 transition-colors"
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              </div>
            ))}

            {/* Completed tasks (collapsed) */}
            {completedTasks.length > 0 && (
              <details className="mt-1">
                <summary className="text-2xs text-text-tertiary cursor-pointer hover:text-text-secondary transition-colors px-2 py-1">
                  {completedTasks.length} completed
                </summary>
                <div className="mt-1 space-y-0.5">
                  {completedTasks.map((task) => (
                    <div
                      key={task.id}
                      className="flex items-start gap-2 rounded-md px-2 py-1 opacity-60"
                    >
                      <CheckCircle2 size={12} className="mt-0.5 shrink-0 text-success-400" />
                      <span className="text-xs text-text-tertiary line-through">{task.title}</span>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
