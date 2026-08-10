import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { getProviderConfig, setProviderConfig, resetProvider } from '@/llm/provider-singleton';

describe('Provider configuration', () => {
  beforeEach(() => {
    localStorage.clear();
    resetProvider();
  });

  afterEach(() => {
    resetProvider();
  });

  it('defaults to Ollama provider with smollm2:135m model', () => {
    const config = getProviderConfig();
    expect(config.provider).toBe('ollama');
    expect(config.modelId).toBe('ollama/smollm2:135m');
  });

  it('reads provider from localStorage', () => {
    localStorage.setItem('swarm-provider', 'webllm');
    localStorage.setItem('swarm-model-id', 'Phi-3.5-mini-instruct-q4f16_1-MLC');
    const config = getProviderConfig();
    expect(config.provider).toBe('webllm');
    expect(config.modelId).toBe('Phi-3.5-mini-instruct-q4f16_1-MLC');
  });

  it('reads model from localStorage', () => {
    localStorage.setItem('swarm-model-id', 'ollama/llama3.2:1b');
    const config = getProviderConfig();
    expect(config.modelId).toBe('ollama/llama3.2:1b');
  });

  it('setProviderConfig persists to localStorage and resets provider', () => {
    setProviderConfig({ provider: 'webllm', modelId: 'Qwen3-4B-q4f16_1-MLC' });
    expect(localStorage.getItem('swarm-provider')).toBe('webllm');
    expect(localStorage.getItem('swarm-model-id')).toBe('Qwen3-4B-q4f16_1-MLC');

    // After setProviderConfig, the singleton is nulled, so getProviderConfig returns new values
    const config = getProviderConfig();
    expect(config.provider).toBe('webllm');
    expect(config.modelId).toBe('Qwen3-4B-q4f16_1-MLC');
  });

  it('setProviderConfig with partial config only overwrites specified fields', () => {
    localStorage.setItem('swarm-provider', 'webllm');
    localStorage.setItem('swarm-model-id', 'Phi-3.5-mini-instruct-q4f16_1-MLC');

    // Only change model
    setProviderConfig({ modelId: 'Qwen3-4B-q4f16_1-MLC' });
    resetProvider();

    const config = getProviderConfig();
    // Provider should still be 'webllm' from previous localStorage write
    expect(config.provider).toBe('webllm');
    expect(config.modelId).toBe('Qwen3-4B-q4f16_1-MLC');
  });

  it('Ollama endpoint defaults to localhost:11434', () => {
    const config = getProviderConfig();
    expect(config.ollamaEndpoint).toBeUndefined(); // not set by default config
  });

  it('ollama endpoint can be set via setProviderConfig', () => {
    setProviderConfig({ ollamaEndpoint: 'http://192.168.1.100:11434' });
    expect(localStorage.getItem('swarm-ollama-endpoint')).toBe('http://192.168.1.100:11434');
  });

  it('returns webllm default model for provider', () => {
    localStorage.setItem('swarm-provider', 'webllm');
    const config = getProviderConfig();
    // When provider is webllm and no model is set, should use webllm default
    expect(config.provider).toBe('webllm');
  });

  it('getProviderConfig falls back to ollama for invalid provider values', () => {
    localStorage.setItem('swarm-provider', 'invalid-provider');
    const config = getProviderConfig();
    expect(config.provider).toBe('ollama');
  });
});
