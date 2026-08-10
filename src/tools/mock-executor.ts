import type { ToolExecutor, ToolResult } from '@/types/tool';

/**
 * Mock tool executor returning canned realistic responses.
 * Used for testing and demo without real sandbox/render backends.
 */
export class MockToolExecutor implements ToolExecutor {
  async execute(toolId: string, params: Record<string, unknown>): Promise<ToolResult> {
    switch (toolId) {
      case 'run_javascript':
        return this.mockRunJavaScript(params);
      case 'preview_html':
        return this.mockPreviewHtml(params);
      case 'render_mermaid':
        return this.mockRenderMermaid(params);
      case 'render_excalidraw':
        return this.mockRenderExcalidraw(params);
      case 'create_file':
        return this.mockCreateFile(params);
      case 'edit_file':
        return this.mockEditFile(params);
      case 'search_code':
        return this.mockSearchCode(params);
      case 'create_task':
        return this.mockCreateTask(params);
      case 'web_search':
        return this.mockWebSearch(params);
      case 'handoff_to_agent':
        // Handoffs are handled by the orchestrator, not the executor
        return { success: true, output: 'Handoff processed by orchestrator.' };
      default:
        return { success: false, output: '', error: `Unknown tool: ${toolId}` };
    }
  }

  private async mockRunJavaScript(params: Record<string, unknown>): Promise<ToolResult> {
    const code = (params['code'] as string) ?? '';
    return {
      success: true,
      output: {
        value: '42',
        logs: [{ level: 'log', args: ['Hello from sandbox'], timestamp: Date.now() }],
        executionTimeMs: 12,
      },
      artifacts: [{
        id: `artifact-${Date.now()}`,
        conversationId: '',
        type: 'code',
        name: 'sandbox-output.js',
        content: code,
        language: 'javascript',
        creatorAgent: 'general',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }],
    };
  }

  private async mockPreviewHtml(params: Record<string, unknown>): Promise<ToolResult> {
    const html = (params['html'] as string) ?? '<p>Preview</p>';
    return {
      success: true,
      output: { previewId: `preview-${Date.now()}`, html },
    };
  }

  private async mockRenderMermaid(params: Record<string, unknown>): Promise<ToolResult> {
    const definition = (params['definition'] as string) ?? '';
    return {
      success: true,
      output: { svg: `<svg><!-- Mermaid diagram rendered --></svg>` },
      artifacts: [{
        id: `artifact-${Date.now()}`,
        conversationId: '',
        type: 'diagram-mermaid',
        name: 'diagram.mmd',
        content: definition,
        creatorAgent: 'general',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }],
    };
  }

  private async mockRenderExcalidraw(params: Record<string, unknown>): Promise<ToolResult> {
    const elements = params['elements'] as unknown;
    return {
      success: true,
      output: { sceneId: `scene-${Date.now()}` },
      artifacts: [{
        id: `artifact-${Date.now()}`,
        conversationId: '',
        type: 'diagram-excalidraw',
        name: 'drawing.excalidraw',
        content: JSON.stringify(elements ?? []),
        creatorAgent: 'general',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }],
    };
  }

  private async mockCreateFile(params: Record<string, unknown>): Promise<ToolResult> {
    const name = (params['name'] as string) ?? 'untitled.txt';
    const content = (params['content'] as string) ?? '';
    const language = (params['language'] as string) ?? 'text';
    const id = `file-${Date.now()}`;
    return {
      success: true,
      output: { fileId: id, name, language },
      artifacts: [{
        id,
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
  }

  private async mockEditFile(params: Record<string, unknown>): Promise<ToolResult> {
    const fileId = (params['file_id'] as string) ?? '';
    return {
      success: true,
      output: { fileId, updated: true },
    };
  }

  private async mockSearchCode(params: Record<string, unknown>): Promise<ToolResult> {
    const query = (params['query'] as string) ?? '';
    return {
      success: true,
      output: {
        results: [
          { fileId: 'file-1', name: 'index.ts', snippet: `// match for "${query}"`, line: 10 },
        ],
      },
    };
  }

  private async mockCreateTask(params: Record<string, unknown>): Promise<ToolResult> {
    const title = (params['title'] as string) ?? 'Untitled task';
    return {
      success: true,
      output: { taskId: `task-${Date.now()}`, title },
    };
  }

  private async mockWebSearch(params: Record<string, unknown>): Promise<ToolResult> {
    const query = (params['query'] as string) ?? '';
    return {
      success: true,
      output: {
        results: [
          { title: `Result for "${query}"`, url: 'https://example.com', snippet: 'Mock search result.' },
        ],
      },
    };
  }
}
