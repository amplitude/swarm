import type { ToolDefinition, ToolResult } from '@/types/tool';
import { toolRegistry } from '../registry';

/**
 * The handoff tool is a special tool available to all agents.
 * When the LLM calls this tool, the orchestrator intercepts it
 * and switches to the target agent. The execute function here
 * is a fallback that should not normally be reached.
 */
const handoffToAgent: ToolDefinition = {
  id: 'handoff_to_agent',
  name: 'Handoff to Agent',
  description: 'Transfer the conversation to a different specialist agent. Use this when another agent would be more helpful for the current request.',
  parameters: {
    type: 'object',
    properties: {
      target_agent: {
        type: 'string',
        enum: ['manager', 'coder', 'pm', 'designer', 'general'],
        description: 'The agent to hand off to.',
      },
      reason: {
        type: 'string',
        description: 'Why you are handing off to this agent.',
      },
      context: {
        type: 'string',
        description: 'A brief summary of the conversation context for the receiving agent.',
      },
    },
    required: ['target_agent', 'reason'],
  },
  availableTo: ['manager', 'coder', 'pm', 'designer', 'general'],
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    // This should be intercepted by the orchestrator.
    // If we reach here, return success so the loop can continue.
    return {
      success: true,
      output: `Handoff to ${params['target_agent']} requested.`,
    };
  },
};

toolRegistry.register(handoffToAgent);
export { handoffToAgent };
