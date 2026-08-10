import type { AgentDefinition } from '@/types/agent';
import { skillRegistry } from '@/skills/registry';

/**
 * Builds the full system prompt for an agent by composing:
 * 1. The agent's base system prompt
 * 2. Skill prompt fragments for each skill the agent has
 *
 * This is called at the start of each agent turn.
 */
export function buildSystemPrompt(agent: AgentDefinition): string {
  const parts: string[] = [agent.systemPrompt];

  // Append skill fragments
  for (const skillId of agent.skills) {
    const skill = skillRegistry.get(skillId);
    if (skill) {
      parts.push(`\n--- Skill: ${skill.name} ---\n${skill.promptFragment}`);

      // Append few-shot examples if present
      if (skill.examples?.length) {
        const exampleBlock = skill.examples
          .map((ex, i) => {
            let block = `Example ${i + 1}:\nUser: ${ex.userMessage}\nAssistant: ${ex.assistantResponse}`;
            if (ex.toolCalls?.length) {
              const toolStr = ex.toolCalls
                .map((tc) => `  ${tc.toolId}(${JSON.stringify(tc.parameters)})`)
                .join('\n');
              block += `\nTool calls:\n${toolStr}`;
            }
            return block;
          })
          .join('\n\n');
        parts.push(exampleBlock);
      }
    }
  }

  return parts.join('\n\n');
}
