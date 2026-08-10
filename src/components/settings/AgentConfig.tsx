import { useState, useCallback } from 'react';
import { agentDefinitions } from '../../agents/definitions';
import type { AgentType } from '../../types/agent';
import { Bot, Code2, ClipboardList, Palette, ListTodo, ChevronDown, ChevronRight } from 'lucide-react';

const AGENT_META: Record<AgentType, { icon: typeof Bot; colorClass: string }> = {
  manager: { icon: ListTodo, colorClass: 'text-primary-400' },
  general: { icon: Bot, colorClass: 'text-agent-general' },
  coder: { icon: Code2, colorClass: 'text-agent-coder' },
  pm: { icon: ClipboardList, colorClass: 'text-agent-pm' },
  designer: { icon: Palette, colorClass: 'text-agent-designer' },
};

export function AgentConfig() {
  const [expandedAgent, setExpandedAgent] = useState<AgentType | null>(null);
  const [editedPrompts, setEditedPrompts] = useState<Partial<Record<AgentType, string>>>({});

  const handlePromptChange = useCallback((agentId: AgentType, value: string) => {
    setEditedPrompts((prev) => ({ ...prev, [agentId]: value }));
    // Update the agent definition in place so changes take effect immediately
    agentDefinitions[agentId] = { ...agentDefinitions[agentId], systemPrompt: value };
  }, []);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-text-secondary">
        Configure agent behavior, system prompts, and available tools.
      </p>
      {(Object.keys(agentDefinitions) as AgentType[]).map((agentId) => {
        const agent = agentDefinitions[agentId];
        const meta = AGENT_META[agentId];
        const Icon = meta.icon;
        const isExpanded = expandedAgent === agentId;

        return (
          <div key={agentId} className="rounded-lg border border-border bg-surface-raised overflow-hidden">
            <button
              onClick={() => setExpandedAgent(isExpanded ? null : agentId)}
              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-surface-overlay transition-colors"
            >
              <span className={`flex h-7 w-7 items-center justify-center rounded-md bg-surface-overlay ${meta.colorClass}`}>
                <Icon size={14} />
              </span>
              <div className="flex-1">
                <span className="text-sm font-medium text-text-primary">{agent.name}</span>
                <span className="ml-2 text-xs text-text-tertiary">{agent.description}</span>
              </div>
              {isExpanded ? <ChevronDown size={14} className="text-text-tertiary" /> : <ChevronRight size={14} className="text-text-tertiary" />}
            </button>

            {isExpanded && (
              <div className="border-t border-border px-4 py-3 flex flex-col gap-3">
                {/* System prompt */}
                <div>
                  <label className="text-xs font-medium text-text-secondary">System Prompt</label>
                  <textarea
                    value={editedPrompts[agentId] ?? agent.systemPrompt}
                    onChange={(e) => handlePromptChange(agentId, e.target.value)}
                    className="mt-1 w-full resize-y rounded-md border border-border bg-surface-inset px-3 py-2 font-mono text-xs text-text-secondary leading-relaxed focus:outline-none focus:ring-1 focus:ring-primary-500"
                    rows={6}
                  />
                </div>

                {/* Tools */}
                <div>
                  <label className="text-xs font-medium text-text-secondary">Tools</label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {agent.tools.map((toolId) => (
                      <span
                        key={toolId}
                        className="rounded-md bg-surface-overlay px-2 py-1 font-mono text-2xs text-text-secondary"
                      >
                        {toolId}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Skills */}
                <div>
                  <label className="text-xs font-medium text-text-secondary">Skills</label>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {agent.skills.map((skillId) => (
                      <span
                        key={skillId}
                        className="rounded-md bg-surface-overlay px-2 py-1 font-mono text-2xs text-text-secondary"
                      >
                        {skillId}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Config values */}
                <div className="flex gap-4 text-xs text-text-tertiary">
                  <span>Temperature: {agent.temperature}</span>
                  <span>Max iterations: {agent.maxIterations}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
