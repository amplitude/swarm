import * as webllm from '@mlc-ai/web-llm';
import type { LLMProvider, LLMRequest, LLMStreamChunk, LLMToolCall } from './engine';

/**
 * WebGPU availability check error message constants.
 * These are used by the UI to detect and classify failures.
 */
export const WEBGPU_UNAVAILABLE_MSG = 'WebGPU is not available in this browser. Please use Chrome 113+, Edge 113+, or another WebGPU-enabled browser.';
export const WEBGPU_NO_ADAPTER_MSG = 'No WebGPU adapter found. Your GPU or drivers may not be supported.';

export class WebLLMProvider implements LLMProvider {
  private engine: webllm.MLCEngineInterface | null = null;
  private loadedModelId: string | null = null;

  async load(
    modelId: string,
    onProgress?: (progress: number, text: string) => void,
  ): Promise<void> {
    if (this.loadedModelId === modelId && this.engine) {
      return;
    }

    if (this.engine) {
      await this.unload();
    }

    // Check WebGPU availability before attempting to create the engine
    const webgpuCheck = await checkWebGPU();
    if (!webgpuCheck.supported) {
      throw new Error(webgpuCheck.error ?? WEBGPU_UNAVAILABLE_MSG);
    }

    const initProgressCallback = (report: webllm.InitProgressReport) => {
      onProgress?.(report.progress, report.text);
    };

    try {
      this.engine = await webllm.CreateMLCEngine(modelId, {
        initProgressCallback,
      });
    } catch (err) {
      // If engine creation fails with a WebGPU-related error, wrap it clearly
      const message = err instanceof Error ? err.message : String(err);
      if (
        message.toLowerCase().includes('webgpu') ||
        message.toLowerCase().includes('gpu') ||
        message.toLowerCase().includes('adapter')
      ) {
        throw new Error(`WebLLM initialization failed (WebGPU error): ${message}`);
      }
      throw err;
    }
    this.loadedModelId = modelId;
  }

  async *generate(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    if (!this.engine) {
      throw new Error('LLM engine not loaded. Call load() first.');
    }

    const hasTools = !!(request.tools && request.tools.length > 0);

    const mappedMessages = request.messages.map((msg) => {
      if (msg.role === 'tool') {
        return {
          role: msg.role as 'tool',
          content: msg.content,
          tool_call_id: msg.tool_call_id ?? '',
        };
      }
      return {
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
      };
    });

    const completionRequest: webllm.ChatCompletionRequest = {
      messages: mappedMessages,
      stream: true,
      stream_options: { include_usage: true },
      temperature: request.temperature,
      max_tokens: request.maxTokens,
      stop: request.stopSequences,
    };

    if (hasTools) {
      completionRequest.tools = request.tools as webllm.ChatCompletionTool[];
      completionRequest.tool_choice = 'auto';
    }

    const chunks = await this.engine.chat.completions.create(completionRequest);

    const accumulatedToolCalls = new Map<
      number,
      { id: string; functionName: string; arguments: string }
    >();

    for await (const chunk of chunks) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;
      const streamChunk: LLMStreamChunk = {
        finishReason: choice.finish_reason,
      };

      if (delta.content) {
        streamChunk.content = delta.content;
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index ?? 0;
          const existing = accumulatedToolCalls.get(idx);
          if (existing) {
            existing.arguments += tc.function?.arguments ?? '';
          } else {
            accumulatedToolCalls.set(idx, {
              id: tc.id ?? `call_${idx}`,
              functionName: tc.function?.name ?? '',
              arguments: tc.function?.arguments ?? '',
            });
          }
        }
      }

      if (choice.finish_reason === 'tool_calls' || choice.finish_reason === 'stop') {
        if (accumulatedToolCalls.size > 0) {
          const toolCalls: LLMToolCall[] = [];
          for (const [, tc] of accumulatedToolCalls) {
            toolCalls.push({
              id: tc.id,
              function: {
                name: tc.functionName,
                arguments: tc.arguments,
              },
            });
          }
          streamChunk.toolCalls = toolCalls;
          accumulatedToolCalls.clear();
        }
      }

      yield streamChunk;
    }
  }

  isLoaded(): boolean {
    return this.engine !== null && this.loadedModelId !== null;
  }

  async unload(): Promise<void> {
    if (this.engine) {
      await this.engine.unload();
      this.engine = null;
      this.loadedModelId = null;
    }
  }

  getLoadedModel(): string | null {
    return this.loadedModelId;
  }
}

/**
 * Check if WebGPU is available in the current browser.
 * Returns { supported: true } or { supported: false, error: string }.
 */
async function checkWebGPU(): Promise<{ supported: boolean; error?: string }> {
  if (typeof navigator === 'undefined' || !navigator.gpu) {
    return { supported: false, error: WEBGPU_UNAVAILABLE_MSG };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { supported: false, error: WEBGPU_NO_ADAPTER_MSG };
    }
    return { supported: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      supported: false,
      error: `Failed to initialize WebGPU: ${message}`,
    };
  }
}
