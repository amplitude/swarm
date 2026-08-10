import { nanoid } from 'nanoid';
import type { ToolDefinition, ToolResult } from '@/types/tool';
import { toolRegistry } from '../registry';

const renderExcalidraw: ToolDefinition = {
  id: 'render_excalidraw',
  name: 'Render Excalidraw Drawing',
  description: 'Create or update an Excalidraw drawing from a JSON array of elements. The UI will render the Excalidraw component with these elements.',
  parameters: {
    type: 'object',
    properties: {
      elements: {
        type: 'array',
        description: 'Array of Excalidraw element objects. Each element should have type, x, y, width, height, and type-specific properties.',
        items: { type: 'object' },
      },
    },
    required: ['elements'],
  },
  availableTo: ['designer', 'general'],
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const elements = params['elements'] as unknown[];
    if (!elements || !Array.isArray(elements)) {
      return { success: false, output: '', error: 'No elements array provided.' };
    }

    // Validation: each element should at least have a type
    for (const el of elements) {
      if (typeof el !== 'object' || el === null || !('type' in el)) {
        return {
          success: false,
          output: '',
          error: 'Each Excalidraw element must be an object with a "type" property.',
        };
      }
    }

    const sceneId = nanoid();
    return {
      success: true,
      output: { sceneId, elementCount: elements.length },
      artifacts: [{
        id: sceneId,
        conversationId: '',
        type: 'diagram-excalidraw',
        name: 'drawing.excalidraw',
        content: JSON.stringify(elements),
        creatorAgent: 'general',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }],
    };
  },
};

toolRegistry.register(renderExcalidraw);
export { renderExcalidraw };
