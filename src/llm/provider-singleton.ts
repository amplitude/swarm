import type { LLMProvider } from './engine';
import { WebLLMProvider } from '@/llm/web-llm-provider';
import { CompatibilityLayer } from './compatibility-layer';
import { DEFAULT_MODEL } from './model-constants';

// ---------------------------------------------------------------------------
// Provider configuration — only WebLLM in production.
// ---------------------------------------------------------------------------

export type ProviderType = 'webllm';

export interface ProviderConfig {
  provider: ProviderType;
  modelId: string;
}

/**
 * Get the current provider configuration.
 * Priority: explicit user preference (localStorage) > defaults.
 * Only WebLLM is used in production. No Ollama, no Demo.
 */
export function getProviderConfig(): ProviderConfig {
  const lsModel = typeof localStorage !== 'undefined' ? localStorage.getItem('swarm-model-id') : null;
  const modelId = lsModel || DEFAULT_MODEL;
  return { provider: 'webllm', modelId };
}

/**
 * Set the provider model ID at runtime (persisted to localStorage).
 */
export function setProviderConfig(config: Partial<ProviderConfig>): void {
  if (config.modelId) {
    localStorage.setItem('swarm-model-id', config.modelId);
  }
  // Rebuild the singleton on next access
  instance = null;
}

// ---------------------------------------------------------------------------
// Provider factory — injectable for testing
// ---------------------------------------------------------------------------

/**
 * Override the provider factory for tests.
 * Set this BEFORE the first call to getSharedProvider().
 * Resets the cached singleton.
 */
export function setProviderFactory(factory: () => LLMProvider): void {
  providerFactory = factory;
  instance = null;
}

// Default: WebLLM only
let providerFactory: () => LLMProvider = () => new CompatibilityLayer(new WebLLMProvider());

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/** Single shared LLMProvider instance */
let instance: LLMProvider | null = null;

/**
 * Get or create the shared provider instance.
 * Always creates a CompatibilityLayer(WebLLMProvider) by default.
 * Call setProviderFactory() before first use to inject an alternative provider.
 */
export function getSharedProvider(): LLMProvider {
  if (!instance) {
    instance = providerFactory();
  }
  return instance;
}

/**
 * Clear the cached provider. Call this after changing model via
 * setProviderConfig() or localStorage directly.
 */
export function resetProvider(): void {
  if (instance) {
    instance.unload().catch(() => {});
    instance = null;
  }
}
