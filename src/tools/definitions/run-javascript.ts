import type { ToolDefinition, ToolResult } from '@/types/tool';
import { toolRegistry } from '../registry';

const runJavaScript: ToolDefinition = {
  id: 'run_javascript',
  name: 'Run JavaScript',
  description: 'Execute JavaScript code in a sandboxed QuickJS WASM environment. The sandbox has no access to DOM, network, or filesystem. Returns the result value and any console output.',
  parameters: {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'The JavaScript code to execute.',
      },
    },
    required: ['code'],
  },
  availableTo: ['coder', 'general'],
  async execute(params: Record<string, unknown>): Promise<ToolResult> {
    const code = params['code'] as string;
    if (!code) {
      return { success: false, output: '', error: 'No code provided.' };
    }

    // Delegate to the QuickJS sandbox (lazy-loaded)
    try {
      const { quickJSSandbox } = await import('@/sandbox/quickjs-sandbox');
      const result = await quickJSSandbox.evaluate(code);
      return {
        success: result.success,
        output: {
          value: result.value ?? null,
          logs: result.logs,
          executionTimeMs: result.executionTimeMs,
        },
        error: result.error,
      };
    } catch (err) {
      return {
        success: false,
        output: '',
        error: `Sandbox unavailable: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  },
};

toolRegistry.register(runJavaScript);
export { runJavaScript };
