import type { ToolDefinition, ToolResult } from '@/types/tool';
import { toolRegistry } from '../registry';

const searchCode: ToolDefinition = {
  id: 'search_code',
  name: 'Search Code',
  description: 'Search through existing code artifacts by keyword or pattern. Returns matching files with relevant snippets.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query (keyword or pattern to match in code artifacts).',
      },
    },
    required: ['query'],
  },
  availableTo: ['coder', 'general'],
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const query = params['query'] as string;
    if (!query) {
      return { success: false, output: '', error: 'No search query provided.' };
    }

    // In a real implementation, this would search artifacts in the persistence layer.
    // For now, return an empty result set. The persistence layer will wire this up.
    return {
      success: true,
      output: { query, results: [] },
    };
  },
};

toolRegistry.register(searchCode);
export { searchCode };
