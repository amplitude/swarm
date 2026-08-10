import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { FallbackProvider, classifyLoadError } from '@/llm/fallback-provider';

describe('classifyLoadError()', () => {
  // -----------------------------------------------------------------------
  // Eligible for fallback — model-specific absence/unsupported/incompatibility
  // -----------------------------------------------------------------------

  it('classifies exact model-not-found (double-quoted) as "model" (eligible)', () => {
    expect(classifyLoadError(new Error('model "non-existent" not found, try pulling it first')))
      .toBe('model');
  });

  it('classifies exact model-not-found (single-quoted) as "model" (eligible)', () => {
    expect(classifyLoadError(new Error("model 'smollm2:135m' not found locally")))
      .toBe('model');
  });

  it('classifies manifest-not-found as "model" (eligible)', () => {
    expect(classifyLoadError(new Error('manifest for model "smollm2:135m" not found')))
      .toBe('model');
  });

  it('classifies "no such model" as "model" (eligible)', () => {
    expect(classifyLoadError(new Error('no such model: smollm2:135m')))
      .toBe('model');
  });

  it('classifies unsupported architecture as "model" (eligible)', () => {
    expect(classifyLoadError(new Error('unsupported architecture for model "smollm2:135m"')))
      .toBe('model');
  });

  it('classifies "architecture not supported" as "model" (eligible)', () => {
    expect(classifyLoadError(new Error('architecture not supported: AVX2 required')))
      .toBe('model');
  });

  it('classifies capability check failure as "model" (eligible)', () => {
    expect(classifyLoadError(new Error('capability check failed: model does not support tool calling')))
      .toBe('model');
    expect(classifyLoadError(new Error('capability-check: model lacks required feature')))
      .toBe('model');
  });

  // -----------------------------------------------------------------------
  // NOT eligible — network connection failures
  // -----------------------------------------------------------------------

  it('classifies ECONNREFUSED as "load" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:11434')))
      .toBe('load');
  });

  it('classifies fetch failure as "load" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('fetch failed')))
      .toBe('load');
  });

  it('classifies wrapped Ollama load failure as "load" (NOT eligible)', () => {
    // Real format from OllamaProvider.load() — wraps the inner error
    expect(classifyLoadError(new Error('Cannot connect to Ollama at http://localhost:11434: fetch failed: connect ECONNREFUSED 127.0.0.1:11434\n\nMake sure Ollama is running (see docs/local-model.md).')))
      .toBe('load');
  });

  it('classifies "Ollama not reachable" as "load" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('Ollama not reachable at http://localhost:11434 (HTTP 500)')))
      .toBe('load');
  });

  it('classifies "Ollama not reachable" HTTP 404 as "load" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('Ollama not reachable at http://localhost:11434 (HTTP 404)')))
      .toBe('load');
  });

  // -----------------------------------------------------------------------
  // NOT eligible — user cancellation
  // -----------------------------------------------------------------------

  it('classifies AbortError as "cancel" (NOT eligible)', () => {
    const abortErr = new Error('The user aborted a request.');
    abortErr.name = 'AbortError';
    expect(classifyLoadError(abortErr)).toBe('cancel');
  });

  it('classifies abort message as "cancel" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('abort'))).toBe('cancel');
  });

  // -----------------------------------------------------------------------
  // NOT eligible — auth
  // -----------------------------------------------------------------------

  it('classifies HTTP 401 as "auth" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('HTTP 401 Unauthorized'))).toBe('auth');
  });

  it('classifies HTTP 403 as "auth" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('HTTP 403 Forbidden'))).toBe('auth');
  });

  it('classifies "Unauthorized" as "auth" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('Unauthorized: invalid token'))).toBe('auth');
  });

  // -----------------------------------------------------------------------
  // NOT eligible — generic 5xx, malformed output, unknown
  // -----------------------------------------------------------------------

  it('classifies generic HTTP 500 as "unknown" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('Ollama API error (HTTP 500): internal server error')))
      .toBe('unknown');
  });

  it('classifies generic HTTP 502 as "unknown" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('Ollama API error (HTTP 502): bad gateway')))
      .toBe('unknown');
  });

  it('classifies HTTP 503 as "unknown" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('Ollama API error (HTTP 503): service unavailable')))
      .toBe('unknown');
  });

  it('classifies JSON parse errors as "unknown" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('Unexpected token T in JSON at position 42')))
      .toBe('unknown');
  });

  it('classifies rate limit errors as "unknown" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('HTTP 429 Too Many Requests')))
      .toBe('unknown');
  });

  it('classifies arbitrary non-model errors as "unknown" (NOT eligible)', () => {
    expect(classifyLoadError(new Error('Something went wrong')))
      .toBe('unknown');
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

    it('falls back to 0.5B when primary smollm2:135m fails with model-not-found (eligible)', async () => {
      // Primary fails with exact model-not-found error thrown by fetch,
      // so OllamaProvider wraps it preserving the original message via
      // extractInnerMessage. Fallback succeeds.
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        callCount++;
        if (url.toString().includes('/api/tags')) {
          if (callCount === 1) {
            // Primary load: fetch rejects with model-not-found
            throw new Error('model "smollm2:135m" not found');
          }
          // Fallback: exists
          return {
            ok: true,
            json: async () => ({
              models: [{ name: 'qwen2.5-coder:0.5b' }],
            }),
          };
        }
        return { ok: true, body: new ReadableStream() };
      });

      await provider.load('ollama/smollm2:135m', onProgress);

      expect(provider.isLoaded()).toBe(true);
      expect(provider.getLoadedModel()).toBe('ollama/qwen2.5-coder:0.5b');
      expect(provider.getFallbackAttempted()).toBe(true);
      const info = provider.getFallbackInfo();
      expect(info.activeModelId).toBe('ollama/qwen2.5-coder:0.5b');
      expect(info.fallbackReason).toContain('smollm2:135m');
    });

    it('falls back to 0.5B when primary smollm2:135m fails with manifest-not-found (eligible)', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        callCount++;
        if (url.toString().includes('/api/tags')) {
          if (callCount === 1) {
            throw new Error('manifest for model "smollm2:135m" not found');
          }
          return {
            ok: true,
            json: async () => ({
              models: [{ name: 'qwen2.5-coder:0.5b' }],
            }),
          };
        }
        return { ok: true, body: new ReadableStream() };
      });

      await provider.load('ollama/smollm2:135m', onProgress);
      expect(provider.isLoaded()).toBe(true);
      expect(provider.getLoadedModel()).toBe('ollama/qwen2.5-coder:0.5b');
      expect(provider.getFallbackAttempted()).toBe(true);
    });

    it('falls back on unsupported architecture (eligible)', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async (url: string) => {
        callCount++;
        if (url.toString().includes('/api/tags')) {
          if (callCount === 1) {
            throw new Error('unsupported architecture for model "smollm2:135m"');
          }
          return {
            ok: true,
            json: async () => ({
              models: [{ name: 'qwen2.5-coder:0.5b' }],
            }),
          };
        }
        return { ok: true, body: new ReadableStream() };
      });

      await provider.load('ollama/smollm2:135m', onProgress);
      expect(provider.isLoaded()).toBe(true);
      expect(provider.getLoadedModel()).toBe('ollama/qwen2.5-coder:0.5b');
      expect(provider.getFallbackAttempted()).toBe(true);
    });

    // -------------------------------------------------------------------
    // Non-eligible: network errors do NOT trigger fallback
    // -------------------------------------------------------------------

    it('does NOT fall back on ECONNREFUSED (network failure)', async () => {
      // Only 1 fetch call should be made (no fallback attempt)
      const fetchFn = vi.fn().mockRejectedValue(
        new Error('fetch failed: connect ECONNREFUSED 127.0.0.1:11434'),
      );
      globalThis.fetch = fetchFn;

      await expect(
        provider.load('ollama/smollm2:135m', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
      // Exactly 1 request — no fallback attempt on network error
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does NOT fall back on Ollama unreachable (HTTP 500)', async () => {
      const fetchFn = vi.fn().mockRejectedValue(
        new Error('Ollama not reachable at http://localhost:11434 (HTTP 500)'),
      );
      globalThis.fetch = fetchFn;

      await expect(
        provider.load('ollama/smollm2:135m', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does NOT fall back on HTTP 500 (generic server error)', async () => {
      const fetchFn = vi.fn().mockRejectedValue(
        new Error('Ollama API error (HTTP 500): internal server error'),
      );
      globalThis.fetch = fetchFn;

      await expect(
        provider.load('ollama/smollm2:135m', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does NOT fall back on HTTP 503 (service unavailable)', async () => {
      const fetchFn = vi.fn().mockRejectedValue(
        new Error('Ollama API error (HTTP 503): service unavailable'),
      );
      globalThis.fetch = fetchFn;

      await expect(
        provider.load('ollama/smollm2:135m', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does NOT fall back on HTTP 404 from /api/tags (server endpoint error)', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        text: async () => 'Not Found',
      });
      globalThis.fetch = fetchFn;

      await expect(
        provider.load('ollama/smollm2:135m', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('loads primary even when model not in local list (Ollama pulls on demand)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'qwen2.5-coder:0.5b' }], // primary model not in list
        }),
      });

      await provider.load('ollama/smollm2:135m', onProgress);

      expect(provider.isLoaded()).toBe(true);
      expect(provider.getLoadedModel()).toBe('ollama/smollm2:135m');
      expect(provider.getFallbackAttempted()).toBe(false);
    });

    // -------------------------------------------------------------------
    // Non-eligible: user cancellation, auth, unknown
    // -------------------------------------------------------------------

    it('does NOT fall back on AbortError (user cancellation)', async () => {
      const abortErr = new DOMException('The operation was aborted', 'AbortError');
      const fetchFn = vi.fn().mockRejectedValue(abortErr);
      globalThis.fetch = fetchFn;

      await expect(
        provider.load('ollama/smollm2:135m', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does NOT fall back on AbortError with cancel message', async () => {
      const fetchFn = vi.fn().mockRejectedValue(
        new Error('The user aborted a request.'),
      );
      globalThis.fetch = fetchFn;

      await expect(
        provider.load('ollama/smollm2:135m', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does NOT fall back on auth errors (HTTP 401)', async () => {
      const fetchFn = vi.fn().mockRejectedValue(
        new Error('HTTP 401 Unauthorized'),
      );
      globalThis.fetch = fetchFn;

      await expect(
        provider.load('ollama/smollm2:135m', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does NOT fall back on auth errors (HTTP 403)', async () => {
      const fetchFn = vi.fn().mockRejectedValue(
        new Error('HTTP 403 Forbidden'),
      );
      globalThis.fetch = fetchFn;

      await expect(
        provider.load('ollama/smollm2:135m', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does NOT fall back on unknown/generation errors', async () => {
      const fetchFn = vi.fn().mockRejectedValue(
        new Error('Unexpected token T in JSON at position 42'),
      );
      globalThis.fetch = fetchFn;

      await expect(
        provider.load('ollama/smollm2:135m', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('does NOT fall back on HTTP 400 from /api/tags (server error)', async () => {
      const fetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        text: async () => 'Bad Request',
      });
      globalThis.fetch = fetchFn;

      await expect(
        provider.load('ollama/smollm2:135m', onProgress),
      ).rejects.toThrow();

      expect(provider.isLoaded()).toBe(false);
      expect(provider.getFallbackAttempted()).toBe(false);
      expect(fetchFn).toHaveBeenCalledTimes(1);
    });

    it('fallback info is accessible after fallback occurs', async () => {
      let callCount = 0;
      globalThis.fetch = vi.fn().mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          const err = new Error('model "smollm2:135m" not found');
          throw err;
        }
        return {
          ok: true,
          json: async () => ({
            models: [{ name: 'qwen2.5-coder:0.5b' }],
          }),
        };
      });

      await provider.load('ollama/smollm2:135m', onProgress);

      const info = provider.getFallbackInfo();
      expect(info.activeModelId).toBe('ollama/qwen2.5-coder:0.5b');
      expect(info.fallbackReason).toBeTruthy();
      expect(typeof info.fallbackReason).toBe('string');
      expect(info.fallbackReason!.length).toBeGreaterThan(10);
    });

  });

  describe('unload()', () => {
    it('resets all state', async () => {
      const provider2 = new FallbackProvider();
      // Simulate fallback state via monkey-patching internal state
      Object.assign(provider2, {
        activeModelId: 'ollama/qwen2.5-coder:0.5b',
        primaryModelId: 'ollama/smollm2:135m',
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

  describe('escalateForCapabilityFailure()', () => {
    let provider: FallbackProvider;
    let originalFetch: typeof globalThis.fetch;

    beforeEach(() => {
      provider = new FallbackProvider();
      originalFetch = globalThis.fetch;
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          models: [{ name: 'smollm2:135m' }],
        }),
      });
    });

    afterEach(async () => {
      globalThis.fetch = originalFetch;
      await provider.unload();
    });

    // -------------------------------------------------------------------
    // Guard: rejected before primary active
    // -------------------------------------------------------------------

    it('rejects escalation when no primary model is active', async () => {
      await expect(
        provider.escalateForCapabilityFailure('135m tool-call failure'),
      ).rejects.toThrow('no primary model is currently active');

      expect(provider.getFallbackAttempted()).toBe(false);
      expect(provider.getLoadedModel()).toBeNull();
    });

    // -------------------------------------------------------------------
    // Guard: rejected on non-capability reasons
    // -------------------------------------------------------------------

    it('rejects escalation on cancellation reason', async () => {
      // Load primary first
      await provider.load('ollama/smollm2:135m');
      expect(provider.getLoadedModel()).toBe('ollama/smollm2:135m');

      await expect(
        provider.escalateForCapabilityFailure('user cancelled the request'),
      ).rejects.toThrow('reason must be capability-related');

      expect(provider.getFallbackAttempted()).toBe(false);
      expect(provider.getLoadedModel()).toBe('ollama/smollm2:135m');
    });

    it('rejects escalation on generic error reason', async () => {
      await provider.load('ollama/smollm2:135m');

      await expect(
        provider.escalateForCapabilityFailure('network error occurred'),
      ).rejects.toThrow('reason must be capability-related');

      expect(provider.getFallbackAttempted()).toBe(false);
    });

    it('rejects escalation on auth error reason', async () => {
      await provider.load('ollama/smollm2:135m');

      await expect(
        provider.escalateForCapabilityFailure('HTTP 401 Unauthorized'),
      ).rejects.toThrow('reason must be capability-related');

      expect(provider.getFallbackAttempted()).toBe(false);
    });

    // -------------------------------------------------------------------
    // Guard: rejected after already fallback
    // -------------------------------------------------------------------

    it('rejects escalation when already on fallback', async () => {
      // Load primary first
      await provider.load('ollama/smollm2:135m');
      expect(provider.getLoadedModel()).toBe('ollama/smollm2:135m');

      // First escalation should work
      await provider.escalateForCapabilityFailure('135m capability check failed');
      expect(provider.getLoadedModel()).toBe('ollama/qwen2.5-coder:0.5b');
      expect(provider.getFallbackAttempted()).toBe(true);

      // Second escalation must be rejected (already on fallback).
      await expect(
        provider.escalateForCapabilityFailure('second escalation: still failing capability'),
      ).rejects.toThrow('already running on a fallback model');

      // State unchanged
      expect(provider.getLoadedModel()).toBe('ollama/qwen2.5-coder:0.5b');
    });

    // -------------------------------------------------------------------
    // Successful escalation flow
    // -------------------------------------------------------------------

    it('successfully escalates from 135m to 0.5B with transition evidence', async () => {
      // Load primary 135m
      await provider.load('ollama/smollm2:135m');
      expect(provider.isLoaded()).toBe(true);
      expect(provider.getLoadedModel()).toBe('ollama/smollm2:135m');
      expect(provider.getFallbackAttempted()).toBe(false);

      // No previous active before any escalation
      expect(provider.getPreviousActiveModelId()).toBeNull();

      // Escalate
      await provider.escalateForCapabilityFailure('135m tool call capability insufficient');

      // Verify transition evidence
      expect(provider.getPreviousActiveModelId()).toBe('ollama/smollm2:135m');
      expect(provider.getLoadedModel()).toBe('ollama/qwen2.5-coder:0.5b');
      expect(provider.getFallbackAttempted()).toBe(true);

      const info = provider.getFallbackInfo();
      expect(info.activeModelId).toBe('ollama/qwen2.5-coder:0.5b');
      expect(info.fallbackReason).toContain('Capability escalation');
      expect(info.fallbackReason).toContain('135m tool call capability insufficient');
      expect(info.fallbackReason).toContain('ollama/smollm2:135m');
      expect(info.fallbackReason).toContain('ollama/qwen2.5-coder:0.5b');
    });

    it('records correct transition for smollm2:135m -> qwen2.5-coder:0.5b (exact model strings)', async () => {
      await provider.load('ollama/smollm2:135m');
      expect(provider.getLoadedModel()).toBe('ollama/smollm2:135m');

      await provider.escalateForCapabilityFailure('135m cannot produce valid tool calls');

      // Exact transition proof
      const previous = provider.getPreviousActiveModelId();
      const current = provider.getLoadedModel();
      expect(previous).toBe('ollama/smollm2:135m');
      expect(current).toBe('ollama/qwen2.5-coder:0.5b');
      // Must not be null -> 0.5B
      expect(previous).not.toBeNull();
      expect(previous).toBeDefined();
    });
  });
});
