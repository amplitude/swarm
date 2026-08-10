import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FallbackProvider, classifyLoadError } from '@/llm/fallback-provider';

describe('classifyLoadError()', () => {
  it('classifies ECONNREFUSED as "load" (eligible)', () => {
    expect(classifyLoadError(new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:11434')))
      .toBe('load');
  });

  it('classifies fetch failure as "load" (eligible)', () => {
    expect(classifyLoadError(new Error('fetch failed')))
      .toBe('load');
  });

  it('classifies wrapped Ollama load failure as "load" (eligible)', () => {
    // Real format from OllamaProvider.load() — wraps the inner error
    expect(classifyLoadError(new Error('Cannot connect to Ollama at http://localhost:11434: fetch failed: connect ECONNREFUSED 127.0.0.1:11434\n\nMake sure Ollama is running (see docs/local-model.md).')))
      .toBe('load');
  });

  it('classifies "Ollama not reachable" as "load" (eligible)', () => {
    expect(classifyLoadError(new Error('Ollama not reachable at http://localhost:11434 (HTTP 500)')))
      .toBe('load');
  });

  it('classifies model-specific errors as "model" (eligible)', () => {
    expect(classifyLoadError(new Error('Ollama API error (HTTP 400): model requires more memory')))
      .toBe('model');
    expect(classifyLoadError(new Error('Ollama API error (HTTP 404): model "foo" not found')))
      .toBe('model');
    expect(classifyLoadError(new Error('model "qwen2.5-coder:0.5b" not found locally')))
      .toBe('model');
    expect(classifyLoadError(new Error('Ollama API error (HTTP 500): internal server error')))
      .toBe('model');
  });

  it('classifies AbortError as "cancel" (NOT eligible)', () => {
    const abortErr = new Error('The user aborted a request.');
    abortErr.name = 'AbortError';
    expect(classifyLoadError(abortErr)).toBe('cancel');
  });

  it('classifies abort message as "cancel" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('abort'))).toBe('cancel');
  });

  it('classifies HTTP 401 as "auth" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('HTTP 401 Unauthorized'))).toBe('auth');
  });

  it('classifies HTTP 403 as "auth" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('HTTP 403 Forbidden'))).toBe('auth');
  });

  it('classifies "Unauthorized" as "auth" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('Unauthorized: invalid token'))).toBe('auth');
  });

  it('classifies unknown errors as "unknown" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('Unexpected token T'))).toBe('unknown');
    expect(classifyLoadError('string error')).toBe('unknown');
    expect(classifyLoadError(null)).toBe('unknown');
    expect(classifyLoadError({ custom: true })).toBe('unknown');
  });
});

describe('FallbackProvider', () => {
  let provider: FallbackProvider;
  let onProgress: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    provider = new FallbackProvider();
    onProgress = vi.fn();
  });

  afterEach(async () => {
    await provider.unload();
  });

  describe('load() with mock fetch', () => {
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      originalFetch = globalThis.fetch;
    });

    afterEach(() => {
      globalThis.fetch = originalFetch;
    });

    it('loads primary model when Ollama is reachable', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'qwen2.5-coder:0.5b' }],
        }),
      });

      await provider.load('ollama/qwen2.5-coder:0.5b', onProgress);

      expect(provider.isLoaded()).toBe(true);
      expect(provider.getLoadedModel()).toBe('ollama/qwen2.5-coder:0.5b');
      expect(provider.getFallbackAttempted()).toBe(false);
      const info = provider.getFallbackInfo();
      expect(info.activeModelId).toBe('ollama/qwen2.5-coder:0.5b');
      expect(info.fallbackModelId).toBeNull();
      expect(info.fallbackReason).toBeNull();
    });

    it('falls back to 1.5B when primary model fails with connection error', async () => {
      // Primary fails with ECONNREFUSED, fallback succeeds
      // Each OllamaProvider.load makes exactly 1 fetch call (/api/tags)
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        callCount++;
        if (url.toString().includes('/api/tags')) {
          // First call (primary load, call 1): fail
          // Second call (fallback load, call 2): succeed
          if (callCount === 1) {
            throw new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:11434');
          }
          return {
            ok: true,
            json: async () => ({
              models: [{ name: 'qwen2.5-coder:1.5b' }],
            }),
          };
        }
        return { ok: true, body: new ReadableStream() };
      });

      await provider.load('ollama/qwen2.5-coder:0.5b', onProgress);

      expect(provider.isLoaded()).toBe(true);
      expect(provider.getLoadedModel()).toBe('ollama/qwen2.5-coder:1.5b');
      expect(provider.getFallbackAttempted()).toBe(true);
      const info = provider.getFallbackInfo();
      expect(info.activeModelId).toBe('ollama/qwen2.5-coder:1.5b');
      expect(info.fallbackModelId).toBe('ollama/qwen2.5-coder:0.5b');
      expect(info.fallbackReason).toContain('qwen2.5-coder:0.5b');
    });

    it('falls back when primary load returns HTTP 404 (model not found)', async () => {
      // Primary OllamaProvider fails with HTTP 404 on /api/tags
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        callCount++;
        if (url.toString().includes('/api/tags')) {
          if (callCount === 1) {
            // Primary: model not found -> HTTP 404
            return {
              ok: false,
              status: 404,
              text: async () => 'model "qwen2.5-coder:0.5b" not found',
            };
          }
          // Fallback: exists
          return {
            ok: true,
            json: async () => ({
              models: [{ name: 'qwen2.5-coder:1.5b' }],
            }),
          };
        }
        return { ok: true, body: new ReadableStream() };
      });

      await provider.load('ollama/qwen2.5-coder:0.5b', onProgress);

      expect(provider.isLoaded()).toBe(true);
      expect(provider.getLoadedModel()).toBe('ollama/qwen2.5-coder:1.5b');
      expect(provider.getFallbackAttempted()).toBe(true);
    });

    it('falls back when primary load returns HTTP error 400', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        callCount++;
        if (url.toString().includes('/api/tags')) {
          if (callCount === 1) {
            // Primary: model requires more memory -> HTTP 400
            return {
              ok: false,
              status: 400,
              text: async () => 'model requires more memory',
            };
          }
          return {
            ok: true,
            json: async () => ({
              models: [{ name: 'qwen2.5-coder:1.5b' }],
            }),
          };
        }
        return { ok: true, body: new ReadableStream() };
      });

      await provider.load('ollama/qwen2.5-coder:0.5b', onProgress);

      expect(provider.isLoaded()).toBe(true);
      expect(provider.getFallbackAttempted()).toBe(true);
      const info = provider.getFallbackInfo();
      expect(info.fallbackReason).toContain('qwen2.5-coder:0.5b');
    });

    it('loads primary even when model not in local list (Ollama pulls on demand)', async () => {
      // OllamaProvider.load only warns if model isn't in the list, doesn't fail
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'llama3.2:1b' }], // primary model not in list
        }),
      });

      // Primary should succeed even though model isn't listed
      await provider.load('ollama/qwen2.5-coder:0.5b', onProgress);

      expect(provider.isLoaded()).toBe(true);
      expect(provider.getLoadedModel()).toBe('ollama/qwen2.5-coder:0.5b');
      expect(provider.getFallbackAttempted()).toBe(false);
    });

    it('does NOT fall back on AbortError (user cancellation)', async () => {
      const abortErr = new DOMException('The operation was aborted', 'AbortError');

      globalThis.fetch = vi.fn().mockRejectedValue(abortErr);

      await expect(
        provider.load('ollama/qwen2.5-coder:0.5b', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
    });

    it('does NOT fall back on AbortError with cancel message', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(
        new Error('The user aborted a request.'),
      );

      await expect(
        provider.load('ollama/qwen2.5-coder:0.5b', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
    });

    it('does NOT fall back on auth errors (HTTP 401)', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(
        new Error('HTTP 401 Unauthorized'),
      );

      await expect(
        provider.load('ollama/qwen2.5-coder:0.5b', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
    });

    it('does NOT fall back on auth errors (HTTP 403)', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(
        new Error('HTTP 403 Forbidden'),
      );

      await expect(
        provider.load('ollama/qwen2.5-coder:0.5b', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
    });

    it('does NOT fall back on unknown/generation errors', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(
        new Error('Unexpected token T in JSON at position 42'),
      );

      await expect(
        provider.load('ollama/qwen2.5-coder:0.5b', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
    });

    it('fallback info is accessible after fallback occurs', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error('fetch failed: connect ECONNREFUSED');
        }
        return {
          ok: true,
          json: async () => ({
            models: [{ name: 'qwen2.5-coder:1.5b' }],
          }),
        };
      });

      await provider.load('ollama/qwen2.5-coder:0.5b', onProgress);

      const info = provider.getFallbackInfo();
      expect(info.activeModelId).toBe('ollama/qwen2.5-coder:1.5b');
      expect(info.fallbackReason).toBeTruthy();
      expect(typeof info.fallbackReason).toBe('string');
      expect(info.fallbackReason!.length).toBeGreaterThan(10);
    });

  });

  describe('unload()', () => {
    it('resets all state', async () => {
      // Simulate fallback state
      const provider2 = new FallbackProvider();
      // Don't actually call load - just verify unload resets state
      // We'll verify by monkey-patching the internal state
      Object.assign(provider2, {
        activeModelId: 'ollama/qwen2.5-coder:1.5b',
        primaryModelId: 'ollama/qwen2.5-coder:0.5b',
        fallbackAttempted: true,
        fallbackReason: 'test reason',
      });

      await provider2.unload();

      expect(provider2.getLoadedModel()).toBeNull();
      expect(provider2.getFallbackAttempted()).toBe(false);
      const info = provider2.getFallbackInfo();
      expect(info.fallbackReason).toBeNull();
    });
  });
});
