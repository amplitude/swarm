import type { ToolDefinition, ToolResult } from '@/types/tool';
import { toolRegistry } from '../registry';

const editFile: ToolDefinition = {
  id: 'edit_file',
  name: 'Edit File',
  description: 'Edit an existing code artifact by its file ID. Provide the new content to replace the file contents.',
  parameters: {
    type: 'object',
    properties: {
      file_id: {
        type: 'string',
        description: 'The ID of the file artifact to edit.',
      },
      content: {
        type: 'string',
        description: 'The new file content.',
      },
    },
    required: ['file_id', 'content'],
  },
  availableTo: ['coder', 'general'],
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const fileId = params['file_id'] as string;
    const content = params['content'] as string;

    if (!fileId || !content) {
      return { success: false, output: '', error: 'Both file_id and content are required.' };
    }

    // In a real implementation, this would update the artifact in the store.
    // For now, we return a success indicator and let the UI layer handle persistence.
    return {
      success: true,
      output: { fileId, updated: true, contentLength: content.length },
    };
  },
};

toolRegistry.register(editFile);
export { editFile };
