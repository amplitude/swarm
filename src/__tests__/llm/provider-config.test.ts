import { describe, it, expect, beforeEach } from 'vitest';
import { getProviderConfig, setProviderConfig, resetProvider } from '@/llm/provider-singleton';

describe('Provider configuration', () => {
  beforeEach(() => {
    localStorage.clear();
    resetProvider();
  });

  it('defaults to WebLLM provider with SmolLM2-135M model', () => {
    const config = getProviderConfig();
    expect(config.provider).toBe('webllm');
    expect(config.modelId).toBe('SmolLM2-135M-Instruct-q0f16-MLC');
  });

  it('reads model from localStorage', () => {
    localStorage.setItem('swarm-model-id', 'SmolLM2-360M-Instruct-q4f16_1-MLC');
    const config = getProviderConfig();
    expect(config.provider).toBe('webllm');
    expect(config.modelId).toBe('SmolLM2-360M-Instruct-q4f16_1-MLC');
  });

  it('setProviderConfig persists to localStorage and resets provider', () => {
    setProviderConfig({ modelId: 'Qwen3-4B-q4f16_1-MLC' });
    expect(localStorage.getItem('swarm-model-id')).toBe('Qwen3-4B-q4f16_1-MLC');

    resetProvider();
    const config = getProviderConfig();
    expect(config.provider).toBe('webllm');
    expect(config.modelId).toBe('Qwen3-4B-q4f16_1-MLC');
  });

  it('getProviderConfig always returns webllm regardless of localStorage', () => {
    localStorage.setItem('swarm-provider', 'ollama');
    const config = getProviderConfig();
    // Provider is always webllm — localStorage is only checked for modelId
    expect(config.provider).toBe('webllm');
    expect(config.modelId).toBe('SmolLM2-135M-Instruct-q0f16-MLC');
  });

  it('default model is used when no localStorage override exists', () => {
    const config = getProviderConfig();
    expect(config.modelId).toBe('SmolLM2-135M-Instruct-q0f16-MLC');

    // After clearing localStorage, defaults still hold
    const config2 = getProviderConfig();
    expect(config2.modelId).toBe('SmolLM2-135M-Instruct-q0f16-MLC');
  });

  it('only modelId can be configured', () => {
    setProviderConfig({ modelId: 'SmolLM2-360M-Instruct-q4f16_1-MLC' });
    const config = getProviderConfig();
    expect(config.modelId).toBe('SmolLM2-360M-Instruct-q4f16_1-MLC');
  });
});
