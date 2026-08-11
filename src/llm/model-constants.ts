/**
 * model-constants.ts — SINGLE source of truth for all automatic/default model IDs.
 *
 * Every automatic model literal, fallback mapping, provider default, and
 * auto-onboarding resolution MUST import from this module. No module in the
 * project may hardcode a model ID intended for automatic selection.
 *
 * DEFAULT: WebLLM + SmolLM2-135M-Instruct-q0f16-MLC (smallest installed chat model).
 * Browser downloads/caches the model automatically; no API key, no paid API.
 * Quality is intentionally low.
 *
 * Invariants enforced by auto-model-invariant.test.ts:
 *   - DEFAULT_MODEL is "SmolLM2-135M-Instruct-q0f16-MLC" (verified installed in @mlc-ai/web-llm)
 *   - MLC_AUTO_MODELS are <=360M params, WebLLM runtime
 *   - Expert models (>1.5B) are structurally excluded from ALL auto paths
 */
// ===========================================================================
// MLC (WebLLM) auto models — <=360M params, WebGPU browser inference
// Zero-setup: browser downloads/caches automatically; no API key needed.
// ===========================================================================

export const MLC_AUTO_MODELS = [
  {
    id: 'SmolLM2-135M-Instruct-q0f16-MLC',
    name: 'SmolLM2 135M',
    size: '~359 MB',
    runtime: 'WebLLM' as const,
    description:
      'Smallest chat/instruct model in @mlc-ai/web-llm v0.2.82 (359 MB VRAM, 135M params). Full fp16 precision. Intentionally low quality — zero-setup default. Browser downloads once, caches automatically. Requires WebGPU + shader-f16 (Chrome 113+). No API key, no paid API.',
  },
  {
    id: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
    name: 'SmolLM2 360M',
    size: '~376 MB',
    runtime: 'WebLLM' as const,
    description:
      'Larger sibling of the default (376 MB VRAM, 360M params). 4-bit quantization. Better quality per VRAM. Users who want slightly more capable responses can switch to this in settings.',
  },
] as const;

// ===========================================================================
// WebLLM / MLC expert-only models (>1.5B, never auto-selected)
// ===========================================================================

export const MLC_EXPERT_MODELS = [
  {
    id: 'Qwen3-8B-q4f16_1-MLC',
    name: 'Qwen 3 8B',
    size: '~5 GB',
    runtime: 'WebLLM' as const,
    description:
      'Best for agents. Strong instruction following and tool use via text. WebGPU required. >1.5B — manually selected only.',
  },
  {
    id: 'Qwen3-4B-q4f16_1-MLC',
    name: 'Qwen 3 4B',
    size: '~3 GB',
    runtime: 'WebLLM' as const,
    description:
      'Lightweight and capable. Good tool calling for its size. WebGPU required. >1.5B — manually selected only.',
  },
] as const;

// ===========================================================================
// Combined recommended models list (for UI display)
// Order: auto WebLLM (default) → expert WebLLM
// ===========================================================================

export const RECOMMENDED_MODELS = [
  ...MLC_AUTO_MODELS,
  ...MLC_EXPERT_MODELS,
] as const;

export type RecommendedModelId = (typeof RECOMMENDED_MODELS)[number]['id'];

// ===========================================================================
// Default model — SmolLM2-135M-Instruct-q0f16-MLC (zero-setup WebLLM)
// ===========================================================================

/** The model auto-selected on first run / when no user preference is stored. */
export const DEFAULT_MODEL = 'SmolLM2-135M-Instruct-q0f16-MLC';

// ===========================================================================
// Provider defaults — per-provider default model IDs
// ===========================================================================

export const PROVIDER_DEFAULT_MODELS: Record<string, string | undefined> = {
  webllm: DEFAULT_MODEL,
};

export type ProviderType = 'webllm';

// ===========================================================================
// Auto-onboarding default resolution
// ===========================================================================

export function resolveOnboardingDefaultModel(): string | undefined {
  return DEFAULT_MODEL;
}

// ===========================================================================
// Enumeration helpers
// ===========================================================================

/**
 * Enumeration of every model ID that can appear in any automatic/default path.
 */
export function enumerateAutoModelIds(): string[] {
  const ids = new Set<string>();
  ids.add(DEFAULT_MODEL);
  for (const m of MLC_AUTO_MODELS) ids.add(m.id);
  for (const v of Object.values(PROVIDER_DEFAULT_MODELS)) if (v) ids.add(v);
  return [...ids];
}

/**
 * Enumeration of every expert-only model ID (>1.5B, never auto-selected).
 */
export function enumerateExpertModelIds(): string[] {
  return MLC_EXPERT_MODELS.map((m) => m.id);
}

/**
 * Check if a model ID is eligible for automatic/default selection.
 * WebLLM models <=360M params are auto-allowed.
 */
export function isModelAutoAllowed(modelId: string): boolean {
  const bare = modelId.replace(/^ollama\//, '');
  const smMatch = bare.match(/^SmolLM2-(\d+)M/i);
  if (smMatch) {
    return parseInt(smMatch[1]!, 10) <= 360;
  }
  const mlcMatch = bare.match(/(\d+)B/);
  if (mlcMatch) {
    return parseFloat(mlcMatch[1]!) <= 0.5;
  }
  return false;
}
