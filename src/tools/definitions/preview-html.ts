import { nanoid } from 'nanoid';
import type { ToolDefinition, ToolResult } from '@/types/tool';
import { toolRegistry } from '../registry';

const previewHtml: ToolDefinition = {
  id: 'preview_html',
  name: 'Preview HTML',
  description: 'Render HTML/CSS/JS in a sandboxed iframe preview. Returns a preview identifier that the UI uses to display the rendered output.',
  parameters: {
    type: 'object',
    properties: {
      html: {
        type: 'string',
        description: 'The complete HTML content to render (can include inline CSS and JS).',
      },
    },
    required: ['html'],
  },
  availableTo: ['coder', 'general'],
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const html = params['html'] as string;
    if (!html) {
      return { success: false, output: '', error: 'No HTML provided.' };
    }

    // The actual iframe rendering is handled by the UI layer.
    // This tool just validates and passes the content through.
    const previewId = nanoid();
    return {
      success: true,
      output: { previewId, html },
      artifacts: [{
        id: previewId,
        conversationId: '',
        type: 'code',
        name: 'preview.html',
        content: html,
        language: 'html',
        creatorAgent: 'general',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }],
    };
  },
};

toolRegistry.register(previewHtml);
export { previewHtml };
