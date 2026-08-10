import type { SkillDefinition } from '@/types/skill';
import { skillRegistry } from '../registry';

const debugging: SkillDefinition = {
  id: 'debugging',
  name: 'Debugging',
  description: 'Diagnose and fix code bugs systematically.',
  promptFragment: `When debugging:
- Reproduce the issue first by understanding the expected vs actual behavior
- Identify the root cause before proposing a fix
- Use run_javascript to test hypotheses when possible
- Explain why the bug occurs, not just how to fix it
- Verify the fix handles edge cases`,
  requiredTools: ['run_javascript'],
};

skillRegistry.register(debugging);
export { debugging };
