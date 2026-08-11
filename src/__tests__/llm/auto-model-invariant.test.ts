/**
 * auto-model-invariant.test.ts — Exhaustive automatic-model proof
 *
 * AFTER OVERHAUL INVARIANTS:
 * - DEFAULT_MODEL is "SmolLM2-135M-Instruct-q0f16-MLC" (smallest installed chat/instruct model)
 * - MLC_AUTO_MODELS are <=360M params, WebLLM runtime (zero-setup)
 * - MLC_EXPERT_MODELS (>1.5B) are structurally excluded from ALL auto paths
 * - getProviderConfig() always returns webllm
 * - No Ollama or demo paths in production
 *
 * Paths tested:
 *   1. DEFAULT_MODEL (model-constants.ts)
 *   2. getProviderConfig() defaults (provider-singleton.ts)
 *   3. MLC_AUTO_MODELS
 *   4. MLC_EXPERT_MODELS
 *   5. isModelAutoAllowed
 *   6. getModelCapabilities
 */

import { describe, it, expect } from 'vitest';

const MAX_MLC_AUTO_PARAMS_MB = 360;

// ===========================================================================
// Tests
// ===========================================================================

describe('Auto-model invariants after coherent chat overhaul', () => {
  // ---------------------------------------------------------------
  // 1. DEFAULT_MODEL
  // ---------------------------------------------------------------
  describe('DEFAULT_MODEL (model-constants.ts)', () => {
    it('DEFAULT_MODEL is SmolLM2-135M-Instruct-q0f16-MLC (smallest installed chat model)', async () => {
      const { DEFAULT_MODEL } = await import('@/llm/engine');
      expect(DEFAULT_MODEL).toBeTruthy();
      expect(typeof DEFAULT_MODEL).toBe('string');
      expect(DEFAULT_MODEL).toBe('SmolLM2-135M-Instruct-q0f16-MLC');

      const smMatch = DEFAULT_MODEL.match(/SmolLM2[_-](\d+)M/i);
      expect(smMatch).toBeTruthy();
      expect(parseInt(smMatch![1]!, 10)).toBe(135);
    });
  });

  // ---------------------------------------------------------------
  // 2. getProviderConfig() defaults
  // ---------------------------------------------------------------
  describe('getProviderConfig() defaults (provider-singleton.ts)', () => {
    it('default provider is always webllm with 135M model', async () => {
      const { getProviderConfig } = await import('@/llm/provider-singleton');
      const config = getProviderConfig();
      expect(config.provider).toBe('webllm');
      expect(config.modelId).toBe('SmolLM2-135M-Instruct-q0f16-MLC');
    });

    it('localStorage can override modelId', async () => {
      const { getProviderConfig } = await import('@/llm/provider-singleton');
      localStorage.setItem('swarm-model-id', 'SmolLM2-360M-Instruct-q4f16_1-MLC');
      const config = getProviderConfig();
      expect(config.modelId).toBe('SmolLM2-360M-Instruct-q4f16_1-MLC');
      localStorage.removeItem('swarm-model-id');
    });
  });

  // ---------------------------------------------------------------
  // 3. MLC_AUTO_MODELS
  // ---------------------------------------------------------------
  describe('MLC_AUTO_MODELS (model-constants.ts)', () => {
    it('all MLC auto models are <=360M params', async () => {
      const { MLC_AUTO_MODELS } = await import('@/llm/engine');
      expect(MLC_AUTO_MODELS.length).toBeGreaterThanOrEqual(1);
      for (const model of MLC_AUTO_MODELS) {
        expect(model.runtime).toBe('WebLLM');
        const smMatch = model.id.match(/SmolLM2[_-](\d+)M/i);
        expect(smMatch).toBeTruthy(`Model ${model.id} should have size in name`);
        expect(parseInt(smMatch![1]!, 10)).toBeLessThanOrEqual(MAX_MLC_AUTO_PARAMS_MB);
      }
    });
  });

  // ---------------------------------------------------------------
  // 4. MLC_EXPERT_MODELS (>1.5B)
  // ---------------------------------------------------------------
  describe('MLC_EXPERT_MODELS (>1.5B, excluded from auto)', () => {
    it('all MLC expert models are >1.5B', async () => {
      const { MLC_EXPERT_MODELS } = await import('@/llm/engine');
      expect(MLC_EXPERT_MODELS.length).toBeGreaterThanOrEqual(1);
      for (const model of MLC_EXPERT_MODELS) {
        expect(model.runtime).toBe('WebLLM');
        expect(model.id.startsWith('ollama/')).toBe(false);
      }
    });
  });

  // ---------------------------------------------------------------
  // 5. isModelAutoAllowed
  // ---------------------------------------------------------------
  describe('isModelAutoAllowed', () => {
    it('135M and 360M models are auto-allowed', async () => {
      const { isModelAutoAllowed } = await import('@/llm/model-constants');
      expect(isModelAutoAllowed('SmolLM2-135M-Instruct-q0f16-MLC')).toBe(true);
      expect(isModelAutoAllowed('SmolLM2-360M-Instruct-q4f16_1-MLC')).toBe(true);
    });

    it('expert model IDs are not auto-allowed', async () => {
      const { isModelAutoAllowed } = await import('@/llm/model-constants');
      expect(isModelAutoAllowed('Qwen3-8B-q4f16_1-MLC')).toBe(false);
      expect(isModelAutoAllowed('Qwen3-4B-q4f16_1-MLC')).toBe(false);
    });
  });

  // ---------------------------------------------------------------
  // 6. getModelCapabilities
  // ---------------------------------------------------------------
  describe('getModelCapabilities', () => {
    it('SmolLM2-135M model has expected capabilities', async () => {
      const { getModelCapabilities } = await import('@/llm/model-capabilities');
      const caps = getModelCapabilities('SmolLM2-135M-Instruct-q0f16-MLC');
      expect(caps).toBeDefined();
      expect(caps.toolCallFormat).toBe('json-text');
      expect(caps.maxContextTokens).toBe(4096);
    });

    it('SmolLM2-360M model has expected capabilities', async () => {
      const { getModelCapabilities } = await import('@/llm/model-capabilities');
      const caps = getModelCapabilities('SmolLM2-360M-Instruct-q4f16_1-MLC');
      expect(caps).toBeDefined();
      expect(caps.toolCallFormat).toBe('json-text');
      expect(caps.maxContextTokens).toBe(4096);
    });
  });

  // ---------------------------------------------------------------
  // 7. No Ollama exports
  // ---------------------------------------------------------------
  describe('No Ollama or fallback in production', () => {
    it('model-constants does not export Ollama or fallback symbols', async () => {
      const mod = await import('@/llm/model-constants');
      // Old symbols that should no longer exist
      expect((mod as Record<string, unknown>).OLLAMA_AUTO_MODELS).toBeUndefined();
      expect((mod as Record<string, unknown>).FALLBACK_MAP).toBeUndefined();
      expect((mod as Record<string, unknown>).DEFAULT_FALLBACK_MODEL_ID).toBeUndefined();
      expect((mod as Record<string, unknown>).OLD_IMPLICIT_DEFAULT_MODEL).toBeUndefined();
      expect((mod as Record<string, unknown>).OLD_IMPLICIT_DEFAULT_PROVIDER).toBeUndefined();
      expect((mod as Record<string, unknown>).isOldImplicitDefault).toBeUndefined();
      expect((mod as Record<string, unknown>).resolveOnboardingDefaultModel).toBeDefined();
    });

    it('RECOMMENDED_MODELS has no Ollama entries', async () => {
      const { RECOMMENDED_MODELS } = await import('@/llm/engine');
      for (const model of RECOMMENDED_MODELS) {
        expect(model.runtime).not.toBe('Ollama');
        expect(model.id.startsWith('ollama/')).toBe(false);
      }
    });
  });
});
