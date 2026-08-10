import type { SkillDefinition } from '@/types/skill';
import { skillRegistry } from '../registry';

const codeReview: SkillDefinition = {
  id: 'code_review',
  name: 'Code Review',
  description: 'Review code for bugs, style issues, and improvement opportunities.',
  promptFragment: `When reviewing code:
- Check for correctness first (logic errors, edge cases, off-by-one)
- Then check for readability and maintainability
- Suggest concrete fixes, not just vague advice
- Point out security issues if present (injection, XSS, etc.)
- Keep feedback constructive and specific`,
};

skillRegistry.register(codeReview);
export { codeReview };
