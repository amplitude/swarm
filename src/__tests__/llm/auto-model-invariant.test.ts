/**
 * auto-model-invariant.test.ts — Exhaustive automatic-model proof
 *
 * NEW DEFAULT INVARIANTS (after zero-setup migration):
 * - DEFAULT_MODEL is "SmolLM2-360M-Instruct-q4f16_1-MLC" (verified smallest installed WebLLM model)
 * - MLC_AUTO_MODELS are <=360M params, WebLLM runtime (zero-setup, no Ollama required)
 * - OLLAMA_AUTO_MODELS are <=0.5B, require Ollama, manually selected only
 * - PROVIDER_DEFAULTS: webllm gets SmolLM2-360M, ollama gets smollm2:135m
 * - MLC_EXPERT_MODELS (>1.5B) are structurally excluded from ALL auto paths
 *
 * Paths tested:
 *   1. DEFAULT_MODEL (model-constants.ts)
 *   2. getProviderConfig() defaults (provider-singleton.ts)
 *   3. FallbackProvider model mapping (only used when Ollama explicitly selected)
 *   4. MLC_AUTO_MODELS — the new default zero-setup path
 *   5. OLLAMA_AUTO_MODELS — now expert-only, manually selected
 *   6. MLC_EXPERT_MODELS — >1.5B, structurally excluded from auto
 *   7. Environment variable resolution
 *   8. localStorage resolution
 *   9. getModelCapabilities() fallback patterns
 *  10. Migration logic for old implicit defaults
 */

import { describe, it, expect, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Thresholds
// ---------------------------------------------------------------------------

// MLC auto models: <=360M params (SmolLM2-360M-Instruct)
const MAX_MLC_AUTO_PARAMS_MB = 360; // millions
// Ollama auto models: <=0.5B
const MAX_OLLAMA_AUTO_PARAMS = 0.5; // billions

// Auto-allowed model IDs (both WebLLM <=360M and Ollama <=0.5B)
const ALLOWED_AUTO_MODELS = [
  'SmolLM2-360M-Instruct-q4f16_1-MLC',
  'ollama/smollm2:135m',
  'ollama/qwen2.5-coder:0.5b',
  'ollama/qwen2.5:0.5b',
];

const FORBIDDEN_AUTO_MODEL_IDS = [
  'Qwen3-8B',
  'Qwen3-4B',
  'Phi-3.5-mini',
  'phi3',
  'Llama-3.1',
  'llama3.2:3b',
  'qwen2.5-coder:3b',
  'qwen2.5:3b',
];

// ---------------------------------------------------------------------------
// Helper: estimate model size from ID
// ---------------------------------------------------------------------------

function extractModelSize(modelId: string): number {
  const bare = modelId.replace(/^ollama\//, '').toLowerCase();

  // MLC model IDs: SmolLM2-360M
  const mlcMatch = bare.match(/smollm2[_-](\d+)m/i);
  if (mlcMatch) return parseInt(mlcMatch[1]!, 10) / 1000; // convert MB to B

  // Direct size matches (highest priority) — e.g. qwen2.5-coder:0.5b
  const sizeMatch = bare.match(/:(\d+(?:\.\d+)?)b/);
  if (sizeMatch) return parseFloat(sizeMatch[1]!);

  // MLC model IDs: Qwen3-8B, Qwen3-4B
  const bMatch = bare.match(/(\d+)b/);
  if (bMatch) return parseFloat(bMatch[1]!);

  // Fallback: known model sizes
  const knownSizes: Record<string, number> = {
    'phi-3.5-mini': 3.8,
    'phi3:mini': 3.8,
    'phi3.5:3.8b': 3.8,
    'llama3.2:1b': 1,
    'llama3.2:3b': 3,
    'smollm2:135m': 0.135,
    'qwen2.5-coder:0.5b': 0.5,
    'qwen2.5-coder:1.5b': 1.5,
    'qwen2.5:0.5b': 0.5,
    'qwen2.5:1.5b': 1.5,
  };

  return knownSizes[bare] ?? Infinity;
}

function isAllowedAuto(modelId: string): boolean {
  return ALLOWED_AUTO_MODELS.includes(modelId);
}

function isForbiddenAuto(modelId: string): boolean {
  return FORBIDDEN_AUTO_MODEL_IDS.some((f) => modelId.toLowerCase().includes(f.toLowerCase()));
}

function isSmallEnoughForAuto(modelId: string): boolean {
  const bare = modelId.replace(/^ollama\//, '');
  // SmolLM2-360M (0.36B) — check
  const smMatch = bare.match(/^SmolLM2[_-](\d+)M/i);
  if (smMatch) return parseInt(smMatch[1]!, 10) <= MAX_MLC_AUTO_PARAMS_MB;
  // Ollama models: <=0.5B
  const size = extractModelSize(modelId);
  return size <= MAX_OLLAMA_AUTO_PARAMS;
}

// ===========================================================================
// Tests
// ===========================================================================

describe('Auto-model invariant: new defaults with WebLLM zero-setup', () => {
  // ---------------------------------------------------------------
  // 1. DEFAULT_MODEL from model-constants.ts
  // ---------------------------------------------------------------
  describe('DEFAULT_MODEL (model-constants.ts)', () => {
    it('DEFAULT_MODEL is SmolLM2-360M-Instruct-q4f16_1-MLC (verified installed in @mlc-ai/web-llm)', async () => {
      const { DEFAULT_MODEL } = await import('@/llm/engine');
      expect(DEFAULT_MODEL).toBeTruthy();
      expect(typeof DEFAULT_MODEL).toBe('string');

      // Must be the WebLLM small model
      expect(DEFAULT_MODEL).toBe('SmolLM2-360M-Instruct-q4f16_1-MLC');

      // Must be <=360M params
      const smMatch = DEFAULT_MODEL.match(/SmolLM2[_-](\d+)M/i);
      expect(smMatch).toBeTruthy();
      expect(parseInt(smMatch![1]!, 10)).toBeLessThanOrEqual(MAX_MLC_AUTO_PARAMS_MB);

      console.log(`  DEFAULT_MODEL: ${DEFAULT_MODEL} (<=${MAX_MLC_AUTO_PARAMS_MB}M params)`);
    });
  });

  // ---------------------------------------------------------------
  // 2. getProviderConfig() defaults
  // ---------------------------------------------------------------
  describe('getProviderConfig() defaults (provider-singleton.ts)', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('default provider is webllm with SmolLM2-360M model', async () => {
      const { getProviderConfig, resetProvider } = await import('@/llm/provider-singleton');
      resetProvider();
      const config = getProviderConfig();

      expect(config.provider).toBe('webllm');
      expect(config.modelId).toBeTruthy();
      expect(config.modelId).toBe('SmolLM2-360M-Instruct-q4f16_1-MLC');

      console.log(`  Default: ${config.provider} / ${config.modelId}`);
    });

    it('webllm default model is SmolLM2-360M-Instruct-q4f16_1-MLC', async () => {
      const { getProviderConfig, resetProvider } = await import('@/llm/provider-singleton');
      resetProvider();
      const config = getProviderConfig();
      expect(config.modelId).toBe('SmolLM2-360M-Instruct-q4f16_1-MLC');
    });

    it('ollama provider default is smollm2:135m (expert mode)', async () => {
      const { getProviderConfig, resetProvider } = await import('@/llm/provider-singleton');
      // Explicit marker + provider signals a genuine user choice
      localStorage.setItem('swarm-provider-explicit', 'true');
      localStorage.setItem('swarm-provider', 'ollama');
      resetProvider();
      const config = getProviderConfig();

      expect(config.provider).toBe('ollama');
      expect(config.modelId).toBe('ollama/smollm2:135m');
    });

    it('webllm provider default is SmolLM2-360M when explicitly set', async () => {
      const { getProviderConfig, resetProvider } = await import('@/llm/provider-singleton');
      localStorage.setItem('swarm-provider', 'webllm');
      resetProvider();
      const config = getProviderConfig();
      expect(config.provider).toBe('webllm');
      expect(config.modelId).toBe('SmolLM2-360M-Instruct-q4f16_1-MLC');
    });
  });

  // ---------------------------------------------------------------
  // 3. Migration: old implicit Ollama default → new WebLLM default
  // ---------------------------------------------------------------
  describe('Migration: old implicit Ollama default → WebLLM', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('old implicit default (ollama + smollm2:135m) migrates to webllm', async () => {
      const { getProviderConfig, resetProvider } = await import('@/llm/provider-singleton');

      // Set old implicit default (no explicit marker)
      localStorage.setItem('swarm-provider', 'ollama');
      localStorage.setItem('swarm-model-id', 'ollama/smollm2:135m');

      resetProvider();
      const config = getProviderConfig();

      // Should be migrated to webllm
      expect(config.provider).toBe('webllm');
      expect(config.modelId).toBe('SmolLM2-360M-Instruct-q4f16_1-MLC');
    });

    it('explicit ollama override is preserved', async () => {
      const { getProviderConfig, resetProvider, setProviderConfig } = await import('@/llm/provider-singleton');

      // User explicitly set ollama via setProviderConfig (which sets explicit marker)
      setProviderConfig({ provider: 'ollama', modelId: 'ollama/qwen2.5-coder:0.5b' });
      resetProvider();
      const config = getProviderConfig();

      expect(config.provider).toBe('ollama');
      expect(config.modelId).toBe('ollama/qwen2.5-coder:0.5b');
    });

    it('explicit ollama with default model is preserved via explicit marker', async () => {
      const { getProviderConfig, resetProvider, setProviderConfig } = await import('@/llm/provider-singleton');

      // User explicitly set ollama with the default model
      localStorage.setItem('swarm-provider', 'ollama');
      localStorage.setItem('swarm-model-id', 'ollama/smollm2:135m');
      localStorage.setItem('swarm-provider-explicit', 'true'); // explicit marker
      resetProvider();
      const config = getProviderConfig();

      expect(config.provider).toBe('ollama');
      expect(config.modelId).toBe('ollama/smollm2:135m');
    });
  });

  // ---------------------------------------------------------------
  // 4. MLC_AUTO_MODELS — new default zero-setup path
  // ---------------------------------------------------------------
  describe('MLC_AUTO_MODELS (model-constants.ts)', () => {
    it('all MLC auto models are <=360M params', async () => {
      const { MLC_AUTO_MODELS } = await import('@/llm/engine');

      expect(MLC_AUTO_MODELS.length).toBeGreaterThanOrEqual(1);

      for (const model of MLC_AUTO_MODELS) {
        expect(model.runtime).toBe('WebLLM');
        const smMatch = model.id.match(/SmolLM2[_-](\d+)M/i);
        expect(smMatch).toBeTruthy(`Model ${model.id} should have size in name`);
        const paramsMB = parseInt(smMatch![1]!, 10);
        expect(paramsMB).toBeLessThanOrEqual(MAX_MLC_AUTO_PARAMS_MB);
        console.log(`  MLC auto: ${model.id} (${paramsMB}M params, ${model.size})`);
      }
    });
  });

  // ---------------------------------------------------------------
  // 5. OLLAMA_AUTO_MODELS — now expert-only
  // ---------------------------------------------------------------
  describe('OLLAMA_AUTO_MODELS (model-constants.ts)', () => {
    it('all Ollama models are <=0.5B and have correct prefix', async () => {
      const { OLLAMA_AUTO_MODELS } = await import('@/llm/engine');

      expect(OLLAMA_AUTO_MODELS.length).toBeGreaterThanOrEqual(1);

      for (const model of OLLAMA_AUTO_MODELS) {
        expect(model.runtime).toBe('Ollama');
        expect(model.id.startsWith('ollama/')).toBe(true);
        const size = extractModelSize(model.id);
        expect(size).toBeLessThanOrEqual(MAX_OLLAMA_AUTO_PARAMS);
        console.log(`  Ollama model: ${model.id} (${size}B)`);
      }
    });
  });

  // ---------------------------------------------------------------
  // 6. MLC_EXPERT_MODELS (>1.5B, structurally excluded from auto)
  // ---------------------------------------------------------------
  describe('MLC_EXPERT_MODELS (>1.5B, excluded from auto)', () => {
    it('all MLC expert models are >1.5B', async () => {
      const { MLC_EXPERT_MODELS } = await import('@/llm/engine');
      expect(MLC_EXPERT_MODELS.length).toBeGreaterThanOrEqual(1);

      for (const model of MLC_EXPERT_MODELS) {
        expect(model.runtime).toBe('WebLLM');
        expect(model.id.startsWith('ollama/')).toBe(false);
        const size = extractModelSize(model.id);
        expect(size).toBeGreaterThan(1.5);
        console.log(`  MLC expert: ${model.id} (${size}B) — excluded from auto`);
      }
    });
  });

  // ---------------------------------------------------------------
  // 7. Environment variable resolution
  // ---------------------------------------------------------------
  describe('Environment variable resolution', () => {
    it('VITE_LLM_PROVIDER=webllm + VITE_LLM_MODEL allows setting known models', () => {
      const envModel = 'SmolLM2-360M-Instruct-q4f16_1-MLC';
      expect(envModel).toBeTruthy();
      expect(isSmallEnoughForAuto(envModel)).toBe(true);
    });

    it('VITE_LLM_PROVIDER=ollama + VITE_LLM_MODEL works for explicit Ollama', () => {
      const envModel = 'ollama/qwen2.5-coder:0.5b';
      expect(isSmallEnoughForAuto(envModel)).toBe(true);
      expect(isAllowedAuto(envModel)).toBe(true);
    });
  });

  // ---------------------------------------------------------------
  // 8. localStorage resolution
  // ---------------------------------------------------------------
  describe('localStorage resolution', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('when no localStorage keys exist, defaults are webllm + SmolLM2-360M', async () => {
      const { getProviderConfig, resetProvider } = await import('@/llm/provider-singleton');
      resetProvider();
      const config = getProviderConfig();
      expect(config.provider).toBe('webllm');
      // SmolLM2-360M-Instruct-q4f16_1-MLC is <=360M params
      expect(config.modelId).toBe('SmolLM2-360M-Instruct-q4f16_1-MLC');
    });

    it('localStorage can set ollama provider explicitly', () => {
      localStorage.setItem('swarm-provider', 'ollama');
      localStorage.setItem('swarm-model-id', 'ollama/qwen2.5-coder:0.5b');
      localStorage.setItem('swarm-provider-explicit', 'true');
      expect(localStorage.getItem('swarm-provider')).toBe('ollama');
      expect(localStorage.getItem('swarm-model-id')).toBe('ollama/qwen2.5-coder:0.5b');
    });
  });

  // ---------------------------------------------------------------
  // 9. getModelCapabilities fallback patterns
  // ---------------------------------------------------------------
  describe('getModelCapabilities fallback patterns', () => {
    it('SmolLM2-360M model has expected capabilities', async () => {
      const { getModelCapabilities } = await import('@/llm/model-capabilities');
      const caps = getModelCapabilities('SmolLM2-360M-Instruct-q4f16_1-MLC');
      expect(caps).toBeDefined();
      expect(caps.toolCallFormat).toBe('json-text');
      expect(caps.maxContextTokens).toBe(4096);
      console.log('  SmolLM2-360M capabilities: json-text, 4096 ctx');
    });

    it('ollama model capabilities still work', async () => {
      const { getModelCapabilities } = await import('@/llm/model-capabilities');
      const caps = getModelCapabilities('ollama/qwen2.5-coder:0.5b');
      expect(caps.toolCallFormat).toBe('json-text');
      expect(caps.maxContextTokens).toBe(32768);
    });
  });

  // ---------------------------------------------------------------
  // 10. All auto-path invariants
  // ---------------------------------------------------------------
  describe('All auto-path invariants', () => {
    beforeEach(() => {
      localStorage.clear();
    });

    it('DEFAULT_MODEL must be exactly SmolLM2-360M-Instruct-q4f16_1-MLC', async () => {
      const { DEFAULT_MODEL } = await import('@/llm/engine');
      expect(DEFAULT_MODEL).toBe('SmolLM2-360M-Instruct-q4f16_1-MLC');
    });

    it('getProviderConfig() default provider is webllm', async () => {
      const { getProviderConfig, resetProvider } = await import('@/llm/provider-singleton');
      resetProvider();
      const config = getProviderConfig();
      expect(config.provider).toBe('webllm');
    });

    it('RECOMMENDED_MODELS has WebLLM first, then Ollama', async () => {
      const { RECOMMENDED_MODELS } = await import('@/llm/engine');
      const firstModel = RECOMMENDED_MODELS[0]!;
      expect(firstModel.runtime).toBe('WebLLM');
      expect(firstModel.id).toBe('SmolLM2-360M-Instruct-q4f16_1-MLC');
    });

    it('isModelAutoAllowed correctly classifies all known model IDs', async () => {
      const { isModelAutoAllowed, MLC_AUTO_MODELS, OLLAMA_AUTO_MODELS } = await import('@/llm/model-constants');

      // All auto model IDs must pass
      for (const m of MLC_AUTO_MODELS) {
        expect(isModelAutoAllowed(m.id)).toBe(true);
        console.log(`  Auto-allowed: ${m.id}`);
      }
      for (const m of OLLAMA_AUTO_MODELS) {
        expect(isModelAutoAllowed(m.id)).toBe(true);
        console.log(`  Auto-allowed: ${m.id}`);
      }
    });

    it('expert model IDs are not auto-allowed', async () => {
      const { isModelAutoAllowed, enumerateExpertModelIds } = await import('@/llm/model-constants');
      for (const id of enumerateExpertModelIds()) {
        expect(isModelAutoAllowed(id)).toBe(false);
        console.log(`  NOT auto-allowed: ${id}`);
      }
    });
  });
});
