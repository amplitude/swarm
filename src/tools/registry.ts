import type { AgentType } from '@/types/agent';
import type { ToolDefinition } from '@/types/tool';

/**
 * Central tool registry. Tools register themselves here and the
 * orchestrator queries available/enabled tools per agent.
 */
class ToolRegistry {
  private tools = new Map<string, ToolDefinition>();

  register(tool: ToolDefinition): void {
    this.tools.set(tool.id, tool);
  }

  get(toolId: string): ToolDefinition | undefined {
    return this.tools.get(toolId);
  }

  getAll(): ToolDefinition[] {
    return Array.from(this.tools.values());
  }

  /** Returns ALL tools available to a specific agent type (for settings UI). */
  getToolsForAgent(agentType: AgentType): ToolDefinition[] {
    return this.getAll().filter((t) => t.availableTo.includes(agentType));
  }

  /**
   * Returns the tools that should be sent to the LLM for a given agent,
   * filtered by an explicit set of enabled tool IDs.
   * If no enabledToolIds are provided, returns all tools for the agent.
   */
  getEnabledToolsForAgent(
    agentType: AgentType,
    enabledToolIds?: Set<string>,
  ): ToolDefinition[] {
    const available = this.getToolsForAgent(agentType);
    if (!enabledToolIds) return available;
    return available.filter((t) => enabledToolIds.has(t.id));
  }

  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }
}

/** Singleton tool registry */
export const toolRegistry = new ToolRegistry();
