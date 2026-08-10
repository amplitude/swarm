import { nanoid } from 'nanoid';
import type { ToolDefinition, ToolResult } from '@/types/tool';
import { toolRegistry } from '../registry';

const renderMermaid: ToolDefinition = {
  id: 'render_mermaid',
  name: 'Render Mermaid Diagram',
  description: 'Render a Mermaid diagram from text definition. Supports flowcharts, sequence diagrams, class diagrams, Gantt charts, and more. Returns the rendered SVG.',
  parameters: {
    type: 'object',
    properties: {
      definition: {
        type: 'string',
        description: 'The Mermaid diagram definition (e.g., "graph TD; A-->B; B-->C;").',
      },
    },
    required: ['definition'],
  },
  availableTo: ['designer', 'pm', 'general'],
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const definition = params['definition'] as string;
    if (!definition) {
      return { success: false, output: '', error: 'No Mermaid definition provided.' };
    }

    try {
      const mermaid = (await import('mermaid')).default;
      mermaid.initialize({ startOnLoad: false, theme: 'dark' });
      const id = `mermaid-${nanoid(8)}`;
      const { svg } = await mermaid.render(id, definition);

      return {
        success: true,
        output: { svg },
        artifacts: [{
          id: nanoid(),
          conversationId: '',
          type: 'diagram-mermaid',
          name: 'diagram.mmd',
          content: definition,
          creatorAgent: 'general',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }],
      };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: `Mermaid render error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

toolRegistry.register(renderMermaid);
export { renderMermaid };
