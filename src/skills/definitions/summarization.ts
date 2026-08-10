import type { SkillDefinition } from '@/types/skill';
import { skillRegistry } from '../registry';

const summarization: SkillDefinition = {
  id: 'summarization',
  name: 'Summarization',
  description: 'Summarize information concisely.',
  promptFragment: `When summarizing:
- Lead with the key takeaway
- Use bullet points for multiple items
- Keep it concise — aim for 1/3 the length of the original
- Preserve the most important details and nuances
- Note any caveats or limitations`,
};

skillRegistry.register(summarization);
export { summarization };
