import { nanoid } from 'nanoid';
import type { ToolDefinition, ToolResult } from '@/types/tool';
import { toolRegistry } from '../registry';

const createTask: ToolDefinition = {
  id: 'create_task',
  name: 'Create Task',
  description: 'Create a new task or ticket with a title and description. Returns the task ID.',
  parameters: {
    type: 'object',
    properties: {
      title: {
        type: 'string',
        description: 'The task title.',
      },
      description: {
        type: 'string',
        description: 'Detailed task description with acceptance criteria.',
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high'],
        description: 'Task priority level.',
      },
    },
    required: ['title'],
  },
  availableTo: ['pm', 'general'],
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const title = params['title'] as string;
    const description = (params['description'] as string) ?? '';
    const priority = (params['priority'] as string) ?? 'medium';

    if (!title) {
      return { success: false, output: '', error: 'Task title is required.' };
    }

    const taskId = nanoid();
    return {
      success: true,
      output: { taskId, title, description, priority, createdAt: Date.now() },
    };
  },
};

toolRegistry.register(createTask);
export { createTask };
