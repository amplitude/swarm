import type { ToolDefinition, ToolResult } from '@/types/tool';
import { toolRegistry } from '../registry';

const webSearch: ToolDefinition = {
  id: 'web_search',
  name: 'Web Search',
  description: 'Search the web for information. Only available when the browser is online. Returns a list of search results with titles, URLs, and snippets.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The search query.',
      },
    },
    required: ['query'],
  },
  availableTo: ['general'],
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const query = params['query'] as string;
    if (!query) {
      return { success: false, output: '', error: 'No search query provided.' };
    }

    // Web search is a placeholder for now.
    // A real implementation could use a public search API or scraping.
    if (!navigator.onLine) {
      return { success: false, output: '', error: 'Browser is offline. Web search unavailable.' };
    }

    return {
      success: false,
      output: '',
      error: 'Web search is not yet implemented. Please answer from your training data.',
    };
  },
};

toolRegistry.register(webSearch);
export { webSearch };
