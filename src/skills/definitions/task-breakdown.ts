import type { SkillDefinition } from '@/types/skill';
import { skillRegistry } from '../registry';

const taskBreakdown: SkillDefinition = {
  id: 'task_breakdown',
  name: 'Task Breakdown',
  description: 'Break complex features into actionable, well-scoped tasks.',
  promptFragment: `When breaking down tasks:
- Each task should be completable in a single work session
- Include a clear title and description with acceptance criteria
- Order tasks by dependency (what must be done first)
- Identify tasks that can be done in parallel
- Use create_task for each individual work item
- After creating tasks, summarize the plan`,
  examples: [
    {
      userMessage: 'Break down building a login page',
      assistantResponse: 'I will break this into 4 tasks.',
      toolCalls: [
        {
          toolId: 'create_task',
          parameters: {
            title: 'Create login form component',
            description: 'Build a React form with email and password fields, validation, and submit handler.',
            priority: 'high',
          },
        },
      ],
    },
  ],
  requiredTools: ['create_task'],
};

skillRegistry.register(taskBreakdown);
export { taskBreakdown };
