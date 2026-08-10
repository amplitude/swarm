import type { ToolExecutor, ToolResult } from '@/types/tool';
import { toolRegistry } from './registry';

/**
 * Real tool executor that dispatches to the actual tool implementations
 * registered in the tool registry.
 */
export class RealToolExecutor implements ToolExecutor {
  async execute(toolId: string, params: Record<string, unknown>): Promise<ToolResult> {
    const tool = toolRegistry.get(toolId);
    if (!tool) {
      return {
        success: false,
        output: '',
        error: `Unknown tool: ${toolId}`,
      };
    }

    try {
      return await tool.execute(params);
    } catch (err) {
      return {
        success: false,
        output: '',
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
