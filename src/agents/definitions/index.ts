import type { AgentDefinition, AgentType } from '@/types/agent';
import { managerAgent } from './manager';
import { coderAgent } from './coder';
import { pmAgent } from './pm';
import { designerAgent } from './designer';
import { generalAgent } from './general';

export const agentDefinitions: Record<AgentType, AgentDefinition> = {
  manager: managerAgent,
  coder: coderAgent,
  pm: pmAgent,
  designer: designerAgent,
  general: generalAgent,
};

export function getAgent(type: AgentType): AgentDefinition {
  return agentDefinitions[type];
}

/**
 * Returns the set of tool IDs that are enabled by default for an agent.
 * If `defaultEnabledTools` is not set, all tools are enabled.
 */
export function getDefaultEnabledTools(type: AgentType): Set<string> {
  const agent = agentDefinitions[type];
  if (agent.defaultEnabledTools) {
    return new Set(agent.defaultEnabledTools);
  }
  return new Set(agent.tools);
}

export { managerAgent, coderAgent, pmAgent, designerAgent, generalAgent };
