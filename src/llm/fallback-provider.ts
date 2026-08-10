import type { LLMProvider, LLMRequest, LLMStreamChunk } from './engine';
import { OllamaProvider } from './ollama-provider';

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

/**
 * Error categories for fallback decisions.
 * Only MODEL errors trigger auto-fallback.
 * 'load' is classified but NOT eligible (network failures should never escalate to a larger model).
 */
export type FallbackErrorType = 'load' | 'model' | 'cancel' | 'auth' | 'generation' | 'unknown';

export interface FallbackEvent {
  /** Which model was ultimately loaded */
  activeModelId: string;
  /** The fallback model that was tried (null if primary succeeded) */
  fallbackModelId: string | null;
  /** Human-readable reason if fallback occurred */
  fallbackReason: string | null;
}

/**
 * Extract the inner error message from an OllamaProvider-wrapped error.
 *
 * OllamaProvider wraps ALL errors during load() with:
 *   "Cannot connect to Ollama at <endpoint>: <original_message>\n\nMake sure Ollama is running..."
 *
 * This function extracts just the <original_message> part so we can classify
 * the root cause accurately. Handles endpoints with colons (e.g. http://host:11434).
 */
function extractInnerMessage(error: Error): string {
  const msg = error.message;
  // Find the prefix position, then scan for the first ": " separator after it
  const prefix = 'Cannot connect to Ollama at ';
  const idx = msg.indexOf(prefix);
  if (idx < 0) return msg;

  const afterPrefix = msg.slice(idx + prefix.length);
  // Find the first ": " — this separates the endpoint from the inner message.
  // Endpoints like http://localhost:11434 contain colons, but they're followed
  // by '/' or digits, never a space. So the first ": " is always the separator.
  const sepIdx = afterPrefix.indexOf(': ');
  if (sepIdx < 0) return msg;

  let inner = afterPrefix.slice(sepIdx + 2); // skip ": "
  // Remove trailing instructions
  const instrIdx = inner.indexOf('\n\nMake sure');
  if (instrIdx >= 0) {
    inner = inner.slice(0, instrIdx);
  }
  return inner;
}

/**
 * Classify an error thrown during provider.load() for fallback eligibility.
 *
 * Eligible (triggers fallback): clearly model-specific absence/unsupported/incompatibility signals
 *   where trying the configured fallback can genuinely help:
 *   - exact model-not-found (e.g. 'model "foo" not found')
 *   - manifest-not-found (e.g. 'manifest for model "foo" not found')
 *   - unsupported-architecture (e.g. 'unsupported architecture')
 *   - app capability-check failure (e.g. 'capability check failed')
 *
 * NOT eligible: AbortError (user cancellation), HTTP 401/403 (auth/config issues),
 *   network connection failure (ECONNREFUSED, fetch failed, Ollama unreachable),
 *   rate limiting, generic 5xx, JSON parse errors, or arbitrary generation errors
 *   that could duplicate side effects.
 */
export function classifyLoadError(error: unknown): FallbackErrorType {
  if (error instanceof Error) {
    const msg = error.message;

    // User cancellation — check original error name first, then wrapped message
    if (
      error.name === 'AbortError' ||
      error.name === 'TimeoutError' ||
      msg.includes('abort') ||
      msg.includes('AbortError') ||
      msg.includes('The operation was aborted') ||
      msg.includes('signal is aborted')
    ) {
      return 'cancel';
    }

    // Extract the inner/original message (OllamaProvider wraps with a common prefix)
    const inner = msg.includes('Cannot connect to Ollama at')
      ? extractInnerMessage(error)
      : msg;

    // Auth/config (non-eligible)
    if (
      msg.includes('401') || msg.includes('403') ||
      msg.includes('Unauthorized') || msg.includes('Forbidden')
    ) {
      return 'auth';
    }

    // Connection / availability failures (NOT eligible — network failures should never
    // escalate to a larger model). Classified as 'load' for diagnostics only.
    if (
      inner.includes('ECONNREFUSED') ||
      inner.includes('fetch failed') ||
      inner.includes('network') ||
      inner.match(/Ollama not reachable/) ||
      inner.match(/Cannot connect to Ollama/)
    ) {
      return 'load';
    }

    // Model-specific absence / unsupported / incompatibility signals (eligible).
    // Only exact patterns where trying the configured fallback can genuinely help.
    if (
      inner.match(/model \"[^\"]+\" not found/) ||
      inner.match(/model '[^']+' not found/) ||
      inner.match(/model .+ not found locally/) ||
      inner.includes('manifest') && inner.includes('not found') ||
      inner.includes('unsupported architecture') ||
      inner.includes('architecture not supported') ||
      inner.includes('capability check') ||
      inner.includes('capability-check') ||
      inner.includes('no such model')
    ) {
      return 'model';
    }
  }

  return 'unknown';
}

// ---------------------------------------------------------------------------
// FallbackProvider
// ---------------------------------------------------------------------------

/**
 * A provider wrapper that implements automatic fallback between two Ollama models.
 *
 * Strategy:
 * - Try primary model (default: qwen2.5-coder:0.5b) first.
 * - On eligible load failures (connection refused, model not found, load errors)
 *   attempt fallback model (default: qwen2.5-coder:1.5b).
 * - Does NOT fallback on user cancellation (AbortError), auth errors (401/403),
 *   or arbitrary generation errors (which could duplicate side effects).
 * - Surface which model is active and why fallback occurred.
 * - User override: if a specific model is configured via provider-singleton,
 *   that takes priority and no fallback chain is used.
 *
 * Usage:
 *   const chain = new FallbackProvider();
 *   await chain.load('ollama/qwen2.5-coder:0.5b', onProgress);
 *   // if 0.5b fails with eligible error, 1.5b is tried automatically
 *   for await (const chunk of chain.generate(request)) { ... }
 */
export class FallbackProvider implements LLMProvider {
  private activeProvider: OllamaProvider;
  private primaryModelId: string | null = null;
  private activeModelId: string | null = null;
  private fallbackReason: string | null = null;
  private fallbackAttempted: boolean = false;

  /** Default fallback model used when primary is ollama/qwen2.5-coder:0.5b */
  private readonly defaultFallbackModelId = 'ollama/qwen2.5-coder:1.5b';

  constructor() {
    this.activeProvider = new OllamaProvider();
  }

  /**
   * Get info about the active model and any fallback that occurred.
   */
  getFallbackInfo(): FallbackEvent {
    return {
      activeModelId: this.activeModelId ?? 'none',
      fallbackModelId: this.fallbackAttempted
        ? (this.activeModelId !== this.primaryModelId ? this.primaryModelId : null)
        : null,
      fallbackReason: this.fallbackReason,
    };
  }

  /**
   * Whether a fallback was attempted in the current session.
   */
  getFallbackAttempted(): boolean {
    return this.fallbackAttempted;
  }

  async load(
    modelId: string,
    onProgress?: (progress: number, text: string) => void,
  ): Promise<void> {
    // If already loaded with this model, skip
    if (this.activeModelId === modelId && this.activeProvider.isLoaded()) {
      return;
    }

    // Remember the primary model requested
    this.primaryModelId = modelId;
    this.fallbackAttempted = false;
    this.fallbackReason = null;

    // Try the primary provider
    const primaryProvider = new OllamaProvider();
    try {
      await primaryProvider.load(modelId, onProgress);
      // Primary succeeded
      this.activeProvider = primaryProvider;
      this.activeModelId = modelId;
      return;
    } catch (err) {
      const errorType = classifyLoadError(err);
      // Only MODEL errors trigger fallback — network failures ('load'), auth,
      // cancellation, and unknown errors never escalate to a larger model.
      const isEligible = errorType === 'model';

      // Determine fallback model ID
      const fallbackId = this.getFallbackModelId(modelId);

      if (!isEligible || !fallbackId) {
        // Not eligible for fallback or no appropriate fallback available
        // Propagate the original error
        throw err;
      }

      // Eligible — try the fallback
      this.fallbackAttempted = true;
      const fallbackProvider = new OllamaProvider();

      try {
        await fallbackProvider.load(fallbackId, (progress, text) => {
          onProgress?.(progress, `[Fallback: tried ${modelId}] ${text}`);
        });
      } catch (_fallbackErr) {
        // Both failed — propagate original error (primary failure)
        throw err;
      }

      // Fallback succeeded
      this.fallbackReason = formatFallbackReason(errorType, modelId, fallbackId, err);
      this.activeProvider = fallbackProvider;
      this.activeModelId = fallbackId;

      // Notify on progress
      onProgress?.(1, `Active: ${fallbackId} (fallback: ${this.fallbackReason})`);
    }
  }

  isLoaded(): boolean {
    return this.activeProvider.isLoaded();
  }

  getLoadedModel(): string | null {
    return this.activeModelId;
  }

  async unload(): Promise<void> {
    this.activeProvider?.unload().catch(() => {});
    this.activeModelId = null;
    this.primaryModelId = null;
    this.fallbackReason = null;
    this.fallbackAttempted = false;
  }

  async *generate(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    if (!this.activeModelId) {
      throw new Error('No model loaded. Call load() first.');
    }

    yield* this.activeProvider.generate(request);
  }

  /**
   * Determine the fallback model ID for a given primary model.
   * Maps small Ollama models to their next-larger counterpart.
   * Returns null if no appropriate fallback is known for this model.
   */
  private getFallbackModelId(primaryModelId: string): string | null {
    const bare = primaryModelId.replace(/^ollama\//, '');

    const fallbackMap: Record<string, string> = {
      'qwen2.5-coder:0.5b': 'ollama/qwen2.5-coder:1.5b',
      'qwen2.5:0.5b': 'ollama/qwen2.5:1.5b',
    };

    const mapped = fallbackMap[bare];
    if (mapped) return mapped;

    // For unknown models, return the default fallback if primary isn't already it
    const defaultFallbackBare = this.defaultFallbackModelId.replace(/^ollama\//, '');
    if (bare !== defaultFallbackBare) {
      return this.defaultFallbackModelId;
    }

    return null;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatFallbackReason(
  errorType: FallbackErrorType,
  primaryModel: string,
  _fallbackModel: string,
  originalError: unknown,
): string {
  const errMsg = originalError instanceof Error ? originalError.message : String(originalError);
  // Extract a concise reason
  let reason: string;
  if (errorType === 'load') {
    reason = `Cannot reach primary model "${primaryModel}": ${errMsg}`;
  } else {
    reason = `Primary model "${primaryModel}" failed: ${errMsg}`;
  }
  return reason;
}
