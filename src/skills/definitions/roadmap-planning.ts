import type { SkillDefinition } from '@/types/skill';
import { skillRegistry } from '../registry';

const roadmapPlanning: SkillDefinition = {
  id: 'roadmap_planning',
  name: 'Roadmap Planning',
  description: 'Plan project milestones and timelines.',
  promptFragment: `When planning roadmaps:
- Group tasks into logical milestones or phases
- Identify dependencies between milestones
- Use a Mermaid Gantt chart to visualize the timeline
- Highlight critical path items
- Keep the plan realistic and flexible`,
  requiredTools: ['render_mermaid'],
};

skillRegistry.register(roadmapPlanning);
export { roadmapPlanning };
