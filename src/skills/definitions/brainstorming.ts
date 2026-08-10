import type { SkillDefinition } from '@/types/skill';
import { skillRegistry } from '../registry';

const brainstorming: SkillDefinition = {
  id: 'brainstorming',
  name: 'Brainstorming',
  description: 'Generate creative ideas and explore possibilities.',
  promptFragment: `When brainstorming:
- Generate multiple distinct ideas (aim for 5+)
- Vary approaches — mix conventional and creative solutions
- Briefly note pros/cons for each idea
- Do not self-censor early — include bold ideas
- After listing ideas, recommend the top 1-2 with reasoning`,
};

skillRegistry.register(brainstorming);
export { brainstorming };
