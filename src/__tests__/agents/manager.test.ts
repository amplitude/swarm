import { describe, it, expect } from 'vitest';
import { agentDefinitions } from '@/agents/definitions';
import type { AgentType } from '@/types/agent';

describe('Task Manager Agent', () => {
  it('manager agent definition exists with delegation system prompt', () => {
    // THIS SHOULD FAIL -- the 'manager' agent does not exist yet.
    // It needs to be created as a meta-agent that can delegate to all others.

    const managerDef = agentDefinitions['manager' as AgentType];

    expect(managerDef).toBeDefined();
    expect(managerDef.id).toBe('manager');
    expect(managerDef.name).toBeTruthy();
    expect(managerDef.systemPrompt).toBeTruthy();
    // The manager's system prompt should mention delegation/coordination
    expect(managerDef.systemPrompt.toLowerCase()).toMatch(/delegat|coordinat|manage|orchestrat/);
  });

  it('manager agent can hand off to all other agents', () => {
    // THIS SHOULD FAIL -- the 'manager' agent does not exist yet.

    const managerDef = agentDefinitions['manager' as AgentType];

    expect(managerDef).toBeDefined();

    // Manager should be able to hand off to all specialist agents
    const expectedTargets: AgentType[] = ['coder', 'pm', 'designer', 'general'];
    for (const target of expectedTargets) {
      expect(managerDef.canHandoffTo).toContain(target);
    }
  });
});
