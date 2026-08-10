import type { SkillDefinition } from '@/types/skill';
import { skillRegistry } from '../registry';

const codeGeneration: SkillDefinition = {
  id: 'code_generation',
  name: 'Code Generation',
  description: 'Generate clean, working code from natural language descriptions.',
  promptFragment: `When generating code:
- Write complete, runnable code — never leave placeholder comments like "// TODO" or "// implement here"
- Include necessary imports
- Use modern JavaScript/TypeScript idioms (const/let, arrow functions, async/await)
- Add brief inline comments only for non-obvious logic
- If the request is ambiguous, make a reasonable choice and state your assumption`,
  examples: [
    {
      userMessage: 'Write a function to reverse a string',
      assistantResponse: 'Here is a string reversal function.',
      toolCalls: [
        {
          toolId: 'create_file',
          parameters: {
            name: 'reverse.ts',
            language: 'typescript',
            content: 'export function reverse(str: string): string {\n  return [...str].reverse().join("");\n}',
          },
        },
      ],
    },
  ],
  requiredTools: ['create_file'],
};

skillRegistry.register(codeGeneration);
export { codeGeneration };
