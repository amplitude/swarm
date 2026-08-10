import type { SkillDefinition } from '@/types/skill';
import { skillRegistry } from '../registry';

const research: SkillDefinition = {
  id: 'research',
  name: 'Research',
  description: 'Research topics and provide well-structured information.',
  promptFragment: `When researching:
- State what you know and what you are uncertain about
- Structure information with clear headings
- Cite sources or reasoning when making claims
- Distinguish facts from opinions
- If web search is available, use it for current information`,
};

skillRegistry.register(research);
export { research };
