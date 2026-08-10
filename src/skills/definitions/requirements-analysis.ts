import type { SkillDefinition } from '@/types/skill';
import { skillRegistry } from '../registry';

const requirementsAnalysis: SkillDefinition = {
  id: 'requirements_analysis',
  name: 'Requirements Analysis',
  description: 'Analyze and clarify project requirements.',
  promptFragment: `When analyzing requirements:
- Identify ambiguities and ask clarifying questions
- List explicit and implicit requirements
- Identify edge cases and error scenarios
- Consider non-functional requirements (performance, accessibility)
- Suggest a Mermaid diagram if the flow is complex`,
};

skillRegistry.register(requirementsAnalysis);
export { requirementsAnalysis };
