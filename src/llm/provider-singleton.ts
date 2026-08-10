import type { LLMProvider } from './engine';
import { WebLLMProvider } from './web-llm-provider';
import { OllamaProvider } from './ollama-provider';
import { CompatibilityLayer } from './compatibility-layer';

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export type ProviderType = 'ollama' | 'webllm';

export interface ProviderConfig {
  /** Inference provider */
  provider: ProviderType;
  /** Model ID (ollama/xxx for Ollama, MLC ID for WebLLM) */
  modelId: string;
  /** Ollama endpoint URL (only used when provider is 'ollama') */
  ollamaEndpoint?: string;
}

/**
 * Get the current provider configuration.
 * Priority: env vars > localStorage > defaults
 */
export function getProviderConfig(): ProviderConfig {
  const envProvider = typeof import.meta !== 'undefined' ? import.meta.env.VITE_LLM_PROVIDER : undefined;
  const lsProvider = typeof localStorage !== 'undefined' ? localStorage.getItem('swarm-provider') : null;
  const rawProvider = (lsProvider || envProvider || 'ollama') as ProviderType;
  // Validate provider value, fall back to 'ollama' for unknown values
  const provider: ProviderType = rawProvider === 'ollama' || rawProvider === 'webllm' ? rawProvider : 'ollama';

  const envModel = typeof import.meta !== 'undefined' ? import.meta.env.VITE_LLM_MODEL : undefined;
  const lsModel = typeof localStorage !== 'undefined' ? localStorage.getItem('swarm-model-id') : null;

  // Default models per provider
  const defaultModels: Record<ProviderType, string> = {
    ollama: 'ollama/qwen2.5-coder:0.5b',
    webllm: 'Phi-3.5-mini-instruct-q4f16_1-MLC',
  };

  const modelId = lsModel || envModel || defaultModels[provider];

  return { provider, modelId };
}

/**
 * Set the provider config at runtime (persisted to localStorage).
 */
export function setProviderConfig(config: Partial<ProviderConfig>): void {
  if (config.provider) localStorage.setItem('swarm-provider', config.provider);
  if (config.modelId) localStorage.setItem('swarm-model-id', config.modelId);
  if (config.ollamaEndpoint) localStorage.setItem('swarm-ollama-endpoint', config.ollamaEndpoint);

  // Rebuild the singleton on next access
  instance = null;
}

// ---------------------------------------------------------------------------
// Singleton
// ---------------------------------------------------------------------------

/** Single shared LLMProvider instance */
let instance: LLMProvider | null = null;

/**
 * Get or create the shared provider instance.
 * Automatically selects the provider based on config:
 * - Ollama (default): lightweight local model via Ollama REST API
 * - WebLLM (fallback): browser-based inference via WebGPU
 *
 * On first call, creates a CompatibilityLayer-wrapped provider.
 * If the config changes, call setProviderConfig() to rebuild.
 */
export function getSharedProvider(): LLMProvider {
  if (!instance) {
    const config = getProviderConfig();

    switch (config.provider) {
      case 'ollama':
        console.log(`[swarm] Using Ollama provider (model: ${config.modelId})`);
        instance = new CompatibilityLayer(new OllamaProvider());
        break;
      case 'webllm':
        console.log(`[swarm] Using WebLLM provider (model: ${config.modelId})`);
        instance = new CompatibilityLayer(new WebLLMProvider());
        break;
      default:
        console.warn(`[swarm] Unknown provider "${config.provider}", falling back to WebLLM`);
        instance = new CompatibilityLayer(new WebLLMProvider());
    }
  }
  return instance;
}

/**
 * Clear the cached provider. Call this after changing config via
 * setProviderConfig() or localStorage directly.
 */
export function resetProvider(): void {
  if (instance) {
    instance.unload().catch(() => {});
    instance = null;
  }
}
