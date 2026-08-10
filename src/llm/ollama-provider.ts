import type { LLMProvider, LLMRequest, LLMStreamChunk, LLMToolCall } from './engine';

/**
 * Default Ollama endpoint. Override via VITE_OLLAMA_ENDPOINT env var
 * or by setting localStorage key 'swarm-ollama-endpoint'.
 */
function getEndpoint(): string {
  const envEndpoint = typeof import.meta !== 'undefined' ? import.meta.env.VITE_OLLAMA_ENDPOINT : undefined;
  const lsEndpoint = typeof localStorage !== 'undefined' ? localStorage.getItem('swarm-ollama-endpoint') : null;
  return lsEndpoint || envEndpoint || 'http://localhost:11434';
}

/**
 * Ollama provider — connects to a local Ollama instance for fast, cheap inference.
 *
 * Requires Ollama running locally (see docs/local-model.md for setup).
 * Supports streaming via SSE.
 */
export class OllamaProvider implements LLMProvider {
  private loadedModelId: string | null = null;
  private abortController: AbortController | null = null;

  async load(
    modelId: string,
    onProgress?: (progress: number, text: string) => void,
  ): Promise<void> {
    if (this.loadedModelId === modelId) return;

    // Strip the "ollama/" prefix if present
    const bareModel = modelId.replace(/^ollama\//, '');

    const endpoint = getEndpoint();
    onProgress?.(0.5, `Connecting to Ollama at ${endpoint} ...`);

    // Check if Ollama is reachable and the model exists
    try {
      const listResp = await fetch(`${endpoint}/api/tags`, { signal: AbortSignal.timeout(5000) });
      if (!listResp.ok) {
        throw new Error(`Ollama not reachable at ${endpoint} (HTTP ${listResp.status})`);
      }
      const listData = await listResp.json() as { models?: Array<{ name: string }> };
      const models = listData.models ?? [];

      // Check if the model exists locally
      const modelExists = models.some((m) => m.name === bareModel || m.name.startsWith(bareModel + ':'));
      if (!modelExists) {
        onProgress?.(0.8, `Model "${bareModel}" not found locally — will pull on first use.`);
        // Ollama auto-pulls models on first request, so this isn't fatal.
        // We just warn the user.
      } else {
        onProgress?.(0.9, `Model "${bareModel}" found locally.`);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new Error(`Cannot connect to Ollama at ${endpoint}: ${message}\n\nMake sure Ollama is running (see docs/local-model.md).`);
    }

    onProgress?.(1, `Ready: ${bareModel}`);
    this.loadedModelId = modelId;
  }

  isLoaded(): boolean {
    return this.loadedModelId !== null;
  }

  getLoadedModel(): string | null {
    return this.loadedModelId;
  }

  async unload(): Promise<void> {
    this.abortController?.abort();
    this.abortController = null;
    this.loadedModelId = null;
  }

  async *generate(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    if (!this.loadedModelId) {
      throw new Error('No model loaded. Call load() first.');
    }

    const bareModel = this.loadedModelId.replace(/^ollama\//, '');
    const endpoint = getEndpoint();

    this.abortController = new AbortController();

    // Build Ollama chat request
    const ollamaMessages = request.messages.map((msg) => ({
      role: msg.role as 'user' | 'assistant' | 'system' | 'tool',
      content: msg.content,
    }));

    const body: Record<string, unknown> = {
      model: bareModel,
      messages: ollamaMessages,
      stream: true,
    };

    if (request.temperature !== undefined) body.temperature = request.temperature;
    if (request.maxTokens !== undefined) body.max_tokens = request.maxTokens;
    if (request.stopSequences !== undefined) body.stop = request.stopSequences;

    // Tools
    if (request.tools && request.tools.length > 0) {
      body.tools = request.tools;
    }

    const response = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: this.abortController.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'unknown error');
      throw new Error(`Ollama API error (HTTP ${response.status}): ${errorText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Ollama stream not available');
    }

    const decoder = new TextDecoder();
    let buffer = '';
    let accumulatedToolCalls = new Map<number, { id: string; functionName: string; arguments: string }>();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.trim()) continue;

          let data: Record<string, unknown>;
          try {
            data = JSON.parse(line);
          } catch {
            continue;
          }

          const chunk: LLMStreamChunk = {};

          if (data.done) {
            chunk.finishReason = 'stop';
          }

          if (data.message && typeof data.message === 'object') {
            const msg = data.message as Record<string, unknown>;

            if (typeof msg.content === 'string' && msg.content) {
              chunk.content = msg.content;
            }

            if (msg.tool_calls && Array.isArray(msg.tool_calls)) {
              for (const [idx, tc] of (msg.tool_calls as Array<{ function?: { name: string; arguments: Record<string, unknown> } }>).entries()) {
                if (tc.function) {
                  accumulatedToolCalls.set(idx, {
                    id: `call_${idx}_${Date.now()}`,
                    functionName: tc.function.name,
                    arguments: JSON.stringify(tc.function.arguments),
                  });
                }
              }
            }
          }

          if (chunk.content || data.done) {
            yield chunk;
          }
        }
      }

      // Flush accumulated tool calls
      if (accumulatedToolCalls.size > 0) {
        const toolCalls: LLMToolCall[] = [];
        for (const [, tc] of accumulatedToolCalls) {
          toolCalls.push({
            id: tc.id,
            function: { name: tc.functionName, arguments: tc.arguments },
          });
        }
        yield { toolCalls, finishReason: 'tool_calls' };
      }
    } finally {
      reader.releaseLock();
      this.abortController = null;
    }
  }
}
