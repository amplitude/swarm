import type { LLMChat, LLMChatResponse } from '@/agents/orchestrator';
import type { LLMProvider, LLMRequest } from './engine';

/**
 * Adapts a streaming LLMProvider into the non-streaming LLMChat interface
 * expected by the Orchestrator. Collects all stream chunks into a single response.
 *
 * Optionally calls `onToken` for each content chunk so the UI can stream tokens.
 */
export class LLMChatAdapter implements LLMChat {

  constructor(
    private provider: LLMProvider,
    private onToken?: (token: string) => void,
  ) {}

  setTraceId(_traceId: string): void {
    // Trace ID tracking reserved for future analytics
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

    let content = '';
    let finishReason: string | null = null;
    let toolCalls: LLMChatResponse['toolCalls'] | undefined;

    try {
      for await (const chunk of this.provider.generate(llmRequest)) {
        if (chunk.content) {
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

      return {
        content: content || null,
        toolCalls,
        finishReason: mappedReason,
      };
    } catch (error) {
      throw error;
    }
  }
}
