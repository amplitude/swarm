import type { LLMChat, LLMChatResponse } from '@/agents/orchestrator';
import type { LLMProvider, LLMRequest } from './engine';
import {
  captureGeneration,
  captureGenerationError,
  startTimer,
} from '@/utils/llm-analytics';

/**
 * Adapts a streaming LLMProvider into the non-streaming LLMChat interface
 * expected by the Orchestrator. Collects all stream chunks into a single response.
 *
 * Optionally calls `onToken` for each content chunk so the UI can stream tokens.
 */
export class LLMChatAdapter implements LLMChat {
  private traceId: string = '';

  constructor(
    private provider: LLMProvider,
    private onToken?: (token: string) => void,
  ) {}

  setTraceId(traceId: string): void {
    this.traceId = traceId;
  }

  getModelId(): string | null {
    return this.provider.getLoadedModel();
  }

  async chatCompletion(request: {
    messages: Array<{ role: string; content: string; tool_call_id?: string }>;
    tools?: Array<{
      type: 'function';
      function: { name: string; description: string; parameters: Record<string, unknown> };
    }>;
    temperature?: number;
  }): Promise<LLMChatResponse> {
    const llmRequest: LLMRequest = {
      messages: request.messages,
      tools: request.tools,
      temperature: request.temperature,
    };

    const model = this.provider.getLoadedModel() ?? 'unknown';
    const genTimer = startTimer();
    let timeToFirstTokenMs: number | undefined;
    let firstTokenRecorded = false;

    let content = '';
    let finishReason: string | null = null;
    let toolCalls: LLMChatResponse['toolCalls'] | undefined;

    try {
      for await (const chunk of this.provider.generate(llmRequest)) {
        if (chunk.content) {
          if (!firstTokenRecorded) {
            timeToFirstTokenMs = genTimer();
            firstTokenRecorded = true;
          }
          content += chunk.content;
          this.onToken?.(chunk.content);
        }

        if (chunk.toolCalls) {
          toolCalls = chunk.toolCalls.map((tc) => ({
            id: tc.id,
            function: { name: tc.function.name, arguments: tc.function.arguments },
          }));
        }

        if (chunk.finishReason) {
          finishReason = chunk.finishReason;
        }
      }

      const mappedReason: LLMChatResponse['finishReason'] =
        finishReason === 'tool_calls' ? 'tool_calls' :
        finishReason === 'length' ? 'length' : 'stop';

      const result: LLMChatResponse = {
        content: content || null,
        toolCalls,
        finishReason: mappedReason,
      };

      captureGeneration({
        traceId: this.traceId,
        model,
        inputMessages: request.messages,
        outputContent: result.content,
        toolCalls: result.toolCalls,
        finishReason: mappedReason,
        latencyMs: genTimer(),
        timeToFirstTokenMs,
        temperature: request.temperature,
        tools: request.tools,
      });

      return result;
    } catch (error) {
      captureGenerationError({
        traceId: this.traceId,
        model,
        inputMessages: request.messages,
        error: error instanceof Error ? error.message : String(error),
        latencyMs: genTimer(),
        temperature: request.temperature,
      });
      throw error;
    }
  }
}
