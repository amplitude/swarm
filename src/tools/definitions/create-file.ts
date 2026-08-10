import { nanoid } from 'nanoid';
import type { ToolDefinition, ToolResult } from '@/types/tool';
import { toolRegistry } from '../registry';

const createFile: ToolDefinition = {
  id: 'create_file',
  name: 'Create File',
  description: 'Create a new code artifact with a name, language, and content. Returns the file ID for later reference or editing.',
  parameters: {
    type: 'object',
    properties: {
      name: {
        type: 'string',
        description: 'The filename (e.g., "index.ts", "styles.css").',
      },
      language: {
        type: 'string',
        description: 'The programming language (e.g., "javascript", "typescript", "html", "css", "json").',
      },
      content: {
        type: 'string',
        description: 'The file content.',
      },
    },
    required: ['name', 'content'],
  },
  availableTo: ['coder', 'general'],
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const name = params['name'] as string;
    const content = params['content'] as string;
    const language = (params['language'] as string) ?? 'text';

    if (!name || !content) {
      return { success: false, output: '', error: 'Both name and content are required.' };
    }

    const fileId = nanoid();
    return {
      success: true,
      output: { fileId, name, language },
      artifacts: [{
        id: fileId,
        conversationId: '',
        type: 'code',
        name,
        content,
        language,
        creatorAgent: 'general',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }],
    };
  },
};

toolRegistry.register(createFile);
export { createFile };
