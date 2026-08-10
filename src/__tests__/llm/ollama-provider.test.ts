import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { OllamaProvider } from '@/llm/ollama-provider';

/**
 * Helper: create a mock fetch response stream for Ollama's /api/chat endpoint.
 * Returns a ReadableStream that emits NDJSON lines.
 */
function createOllamaStream(chunks: Array<Record<string, unknown>>): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const lines = chunks.map((c) => encoder.encode(JSON.stringify(c) + '\n'));
  return new ReadableStream({
    start(controller) {
      for (const line of lines) {
        controller.enqueue(line);
      }
      controller.close();
    },
  });
}

describe('OllamaProvider', () => {
  let provider: OllamaProvider;
  let originalFetch: typeof globalThis.fetch;
  let onProgress: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    provider = new OllamaProvider();
    onProgress = vi.fn();
    localStorage.clear();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    await provider.unload();
  });

  describe('load()', () => {
    it('connects to Ollama and lists available models on load', async () => {
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        if (url.toString().includes('/api/tags')) {
          return {
            ok: true,
            json: async () => ({
              models: [
                { name: 'qwen2.5-coder:0.5b', modified: '2025-01-01' },
              ],
            }),
          };
        }
        return new Response(null, { status: 404 });
      });

      await provider.load('ollama/qwen2.5-coder:0.5b', onProgress);

      expect(provider.isLoaded()).toBe(true);
      expect(provider.getLoadedModel()).toBe('ollama/qwen2.5-coder:0.5b');
      expect(onProgress).toHaveBeenCalled();
    });

    it('loads model without ollama/ prefix', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: 'qwen2.5-coder:0.5b' }] }),
      });

      await provider.load('qwen2.5-coder:0.5b', onProgress);

      expect(provider.isLoaded()).toBe(true);
      expect(provider.getLoadedModel()).toBe('qwen2.5-coder:0.5b');
    });

    it('load() is idempotent when same model is loaded', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: 'qwen2.5-coder:0.5b' }] }),
      });

      await provider.load('ollama/qwen2.5-coder:0.5b', onProgress);
      const callCount = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length;

      // Loading the same model again should be a no-op
      await provider.load('ollama/qwen2.5-coder:0.5b', onProgress);
      expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.length).toBe(callCount);
    });

    it('throws when Ollama is not reachable', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('fetch failed: connect ECONNREFUSED'));

      await expect(provider.load('ollama/qwen2.5-coder:0.5b', onProgress)).rejects.toThrow(
        /Cannot connect to Ollama/,
      );
      expect(provider.isLoaded()).toBe(false);
    });

    it('throws when Ollama returns error status', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      });

      await expect(provider.load('ollama/qwen2.5-coder:0.5b', onProgress)).rejects.toThrow(
        /Cannot connect to Ollama/,
      );
      expect(provider.isLoaded()).toBe(false);
    });

    it('succeeds even if model is not in list (Ollama pulls on demand)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: 'llama3.2:1b' }] }),
      });

      // Loading a model not in the list should still succeed
      await provider.load('ollama/qwen2.5-coder:0.5b', onProgress);
      expect(provider.isLoaded()).toBe(true);
    });

    it('unload() clears model state and allows abort', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ models: [{ name: 'qwen2.5-coder:0.5b' }] }),
      });

      await provider.load('ollama/qwen2.5-coder:0.5b', onProgress);
      expect(provider.isLoaded()).toBe(true);

      await provider.unload();
      expect(provider.isLoaded()).toBe(false);
      expect(provider.getLoadedModel()).toBeNull();
    });
  });

  describe('generate()', () => {
    beforeEach(async () => {
      globalThis.fetch = vi.fn(async (url: string) => {
        if (url.toString().includes('/api/tags')) {
          return {
            ok: true,
            json: async () => ({ models: [{ name: 'qwen2.5-coder:0.5b' }] }),
          };
        }
        // /api/chat
        return {
          ok: true,
          body: createOllamaStream([
            { message: { content: 'Hello' }, done: false },
            { message: { content: ' world' }, done: false },
            { message: { content: '' }, done: true },
          ]),
        };
      });

      await provider.load('ollama/qwen2.5-coder:0.5b');
    });

    it('streams content chunks from Ollama API', async () => {
      const chunks: string[] = [];
      for await (const chunk of provider.generate({ messages: [{ role: 'user', content: 'Hi' }] })) {
        if (chunk.content) chunks.push(chunk.content);
      }

      expect(chunks.join('')).toBe('Hello world');
    });

    it('returns finishReason on last chunk', async () => {
      let lastFinishReason: string | null = null;
      for await (const chunk of provider.generate({ messages: [{ role: 'user', content: 'Hi' }] })) {
        if (chunk.finishReason) lastFinishReason = chunk.finishReason;
      }

      expect(lastFinishReason).toBe('stop');
    });

    it('handles tool_calls from Ollama response', async () => {
      globalThis.fetch = vi.fn(async (url: string) => {
        if (url.toString().includes('/api/tags')) {
          return {
            ok: true,
            json: async () => ({ models: [{ name: 'qwen2.5-coder:0.5b' }] }),
          };
        }
        return {
          ok: true,
          body: createOllamaStream([
            {
              message: {
                content: '',
                tool_calls: [
                  {
                    function: { name: 'run_javascript', arguments: { code: '1+1' } },
                  },
                ],
              },
              done: false,
            },
            { message: { content: '' }, done: true },
          ]),
        };
      });

      await provider.load('ollama/qwen2.5-coder:0.5b');

      let toolCalls: Array<{ function: { name: string } }> | undefined;
      for await (const chunk of provider.generate({
        messages: [{ role: 'user', content: 'Calculate 1+1' }],
        tools: [{ type: 'function', function: { name: 'run_javascript', description: 'Execute JS', parameters: {} } }],
      })) {
        if (chunk.toolCalls) toolCalls = chunk.toolCalls;
      }

      expect(toolCalls).toBeDefined();
      expect(toolCalls).toHaveLength(1);
      expect(toolCalls![0]!.function.name).toBe('run_javascript');
    });

    it('throws when generating without loading a model', async () => {
      const emptyProvider = new OllamaProvider();
      await expect(
        async () => {
          for await (const _ of emptyProvider.generate({ messages: [{ role: 'user', content: 'Hi' }] })) {
            // Should not reach here
          }
        },
      ).rejects.toThrow('No model loaded');
    });

    it('throws on HTTP error from Ollama', async () => {
      globalThis.fetch = vi.fn(async (url: string) => {
        if (url.toString().includes('/api/tags')) {
          return {
            ok: true,
            json: async () => ({ models: [{ name: 'qwen2.5-coder:0.5b' }] }),
          };
        }
        return { ok: false, status: 400, text: async () => 'model requires more memory' };
      });

      await provider.load('ollama/qwen2.5-coder:0.5b');

      await expect(
        async () => {
          for await (const _ of provider.generate({ messages: [{ role: 'user', content: 'Hi' }] })) {
            // Should not reach here
          }
        },
      ).rejects.toThrow(/Ollama API error/);
    });
  });
});
