import type { LLMProvider } from './engine';
import { WebLLMProvider } from './web-llm-provider';
import { OllamaProvider } from './ollama-provider';
import { DemoProvider } from './demo-provider';
import { CompatibilityLayer } from './compatibility-layer';
import {
  PROVIDER_DEFAULT_MODELS,
  DEFAULT_MODEL,
  OLD_IMPLICIT_DEFAULT_MODEL,
} from './model-constants';
import type { ProviderType as PT } from './model-constants';

// ---------------------------------------------------------------------------
// Provider configuration
// ---------------------------------------------------------------------------

export type ProviderType = PT | 'demo';

export interface ProviderConfig {
  /** Inference provider */
  provider: ProviderType;
  /** Model ID (ollama/xxx for Ollama, MLC ID for WebLLM) */
  modelId: string;
  /** Ollama endpoint URL (only used when provider is 'ollama') */
  ollamaEndpoint?: string;
}

/**
 * localStorage key used to track whether a provider choice was explicitly made
 * by the user (as opposed to the old implicit default). When this key is absent,
 * the old implicit default ('ollama' + smollm2:135m) gets migrated to the new
 * WebLLM default on read.
 */
const EXPLICIT_CHOICE_KEY = 'swarm-provider-explicit';

/**
 * Check whether the stored provider/model pair represents an old implicit default
 * that should be migrated to the new WebLLM default.
 *
 * Migration heuristic:
 * - If `swarm-provider-explicit` is set, the user made an explicit choice → preserve.
 * - If `swarm-provider` is 'ollama' AND `swarm-model-id` is the old default
 *   (ollama/smollm2:135m) AND no explicit marker exists → it's the old implicit
 *   default → migrate to WebLLM.
 * - If `swarm-model-id` is set to something OTHER than the old default → preserve
 *   (user explicitly chose a non-default model).
 */
function needsMigration(): boolean {
  // If user explicitly marked their choice, no migration
  try {
    if (localStorage.getItem(EXPLICIT_CHOICE_KEY) !== null) return false;
  } catch {
    // localStorage unavailable (SSR/test)
    return false;
  }

  try {
    const provider = localStorage.getItem('swarm-provider');
    const modelId = localStorage.getItem('swarm-model-id');

    // If no provider or model set at all, this is a fresh install → no migration needed
    if (!provider && !modelId) return false;

    // If model is set to something other than the old default → explicit choice
    if (modelId && modelId !== OLD_IMPLICIT_DEFAULT_MODEL) return false;

    // If provider is explicitly something other than the old default → explicit
    if (provider && provider !== 'ollama') return false;

    // Otherwise: old implicit default → migrate
    return provider === 'ollama' && (modelId === OLD_IMPLICIT_DEFAULT_MODEL || !modelId);
  } catch {
    return false;
  }
}

/**
 * Perform the migration: clear the old implicit default and set the new WebLLM default.
 * Does NOT touch explicit overrides.
 */
function performMigration(): void {
  try {
    // Remove old implicit defaults
    localStorage.removeItem('swarm-provider');
    localStorage.removeItem('swarm-model-id');
    localStorage.removeItem('swarm-last-model');
    localStorage.removeItem('swarm-ollama-endpoint');

    // Mark migration as done so it only runs once
    localStorage.setItem(EXPLICIT_CHOICE_KEY, 'migrated-from-implicit-ollama');

    console.log(
      '[swarm] Migrated old implicit Ollama default to new WebLLM default ' +
      `(${DEFAULT_MODEL})`,
    );
  } catch {
    // Silent fail in SSR
  }
}

/**
 * Get the current provider configuration.
 * Priority: explicit user preference (localStorage) > env vars > defaults.
 * Applies automatic migration for old implicit Ollama defaults.
 */
export function getProviderConfig(): ProviderConfig {
  // Check for migration first
  if (needsMigration()) {
    performMigration();
  }

  const envProvider = typeof import.meta !== 'undefined' ? import.meta.env.VITE_LLM_PROVIDER : undefined;
  const lsProvider = typeof localStorage !== 'undefined' ? localStorage.getItem('swarm-provider') : null;
  const rawProvider = (lsProvider || envProvider || 'webllm') as ProviderType;
  // Validate provider value, fall back to 'webllm' for unknown values
  const validProviders = ['ollama', 'webllm', 'demo'];
  const provider: ProviderType = validProviders.includes(rawProvider) ? rawProvider : 'webllm';

  const envModel = typeof import.meta !== 'undefined' ? import.meta.env.VITE_LLM_MODEL : undefined;
  const lsModel = typeof localStorage !== 'undefined' ? localStorage.getItem('swarm-model-id') : null;

  // Default models per provider (from centralized model-constants.ts)
  // WebLLM defaults to SmolLM2-360M-Instruct-q4f16_1-MLC (zero-setup).
  // Ollama defaults to smollm2:135m (smallest Ollama model, expert mode only).
  // Demo has no model ID.
  const modelId = lsModel || envModel || (provider === 'demo' ? '' : PROVIDER_DEFAULT_MODELS[provider as PT] || '');

  return { provider, modelId };
}

/**
 * Set the provider config at runtime (persisted to localStorage).
 * Marks the choice as explicit so migration won't override it.
 */
export function setProviderConfig(config: Partial<ProviderConfig>): void {
  if (config.provider) {
    localStorage.setItem('swarm-provider', config.provider);
    localStorage.setItem(EXPLICIT_CHOICE_KEY, 'true');
  }
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
 * - WebLLM (default): browser-based inference via WebGPU, zero-setup
 * - Ollama: local model via Ollama REST API (expert mode)
 * - Demo: deterministic template mode (when WebGPU unavailable / init fails)
 *
 * On first call, creates a CompatibilityLayer-wrapped provider.
 * If the config changes, call setProviderConfig() to rebuild.
 */
export function getSharedProvider(): LLMProvider {
  if (!instance) {
    const config = getProviderConfig();

    switch (config.provider) {
      case 'webllm':
        console.log(`[swarm] Using WebLLM provider (model: ${config.modelId})`);
        instance = new CompatibilityLayer(new WebLLMProvider());
        break;
      case 'ollama':
        console.log(`[swarm] Using Ollama provider (model: ${config.modelId})`);
        instance = new CompatibilityLayer(new OllamaProvider());
        break;
      case 'demo':
        console.log(`[swarm] Using Demo provider (no AI — template mode)`);
        instance = new CompatibilityLayer(new DemoProvider());
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
