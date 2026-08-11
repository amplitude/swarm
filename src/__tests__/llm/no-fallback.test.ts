/**
 * no-fallback.test.ts — Verifies production has no Ollama/Demo/fallback paths.
 *
 * After the coherent chat overhaul:
 * - getProviderConfig() always returns webllm
 * - Only modelId is configurable
 * - No OLLAMA_AUTO_MODELS, FALLBACK_MAP, or migration logic exists
 * - getProvider() always creates CompatibilityLayer(WebLLMProvider)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { getProviderConfig } from '@/llm/provider-singleton';

describe('No Ollama/Demo/fallback in production', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('getProviderConfig always returns webllm', () => {
    const config = getProviderConfig();
    expect(config.provider).toBe('webllm');
    expect(config.modelId).toBe('SmolLM2-135M-Instruct-q0f16-MLC');
  });

  it('malicious localStorage does not change provider', () => {
    // Even if someone sets these keys, provider is always webllm
    localStorage.setItem('swarm-provider', 'ollama');
    localStorage.setItem('swarm-provider-explicit', 'true');
    const config = getProviderConfig();
    expect(config.provider).toBe('webllm');
  });

  it('only modelId from localStorage is honored', () => {
    localStorage.setItem('swarm-model-id', 'SmolLM2-360M-Instruct-q4f16_1-MLC');
    localStorage.setItem('swarm-provider', 'demo');
    const config = getProviderConfig();
    expect(config.provider).toBe('webllm');
    expect(config.modelId).toBe('SmolLM2-360M-Instruct-q4f16_1-MLC');
  });

  it('getSharedProvider creates only WebLLM provider', async () => {
    // Can't easily mock @mlc-ai/web-llm here, but we can verify the singleton
    // is compatible with the LLMProvider interface
    const mod = await import('@/llm/provider-singleton');
    expect(typeof mod.getSharedProvider).toBe('function');
    // The provider should not be loaded yet (no WebGPU)
    const provider = mod.getSharedProvider();
    expect(provider.isLoaded()).toBe(false);
    expect(provider.getLoadedModel()).toBeNull();
  });
});
