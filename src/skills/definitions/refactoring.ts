import type { SkillDefinition } from '@/types/skill';
import { skillRegistry } from '../registry';

const refactoring: SkillDefinition = {
  id: 'refactoring',
  name: 'Refactoring',
  description: 'Improve code structure without changing behavior.',
  promptFragment: `When refactoring:
- Preserve existing behavior exactly
- Make one improvement at a time
- Prefer simpler solutions over clever ones
- Extract repeated logic into functions only when there are 3+ occurrences
- Rename variables for clarity when names are misleading`,
};

skillRegistry.register(refactoring);
export { refactoring };
