/**
 * model-constants.ts — SINGLE source of truth for all automatic/default model IDs.
 *
 * Every automatic model literal, fallback mapping, provider default, and
 * auto-onboarding resolution MUST import from this module. No module in the
 * project may hardcode a model ID intended for automatic selection.
 *
 * Invariants enforced by auto-model-invariant.test.ts:
 *   - DEFAULT_MODEL is always "ollama/qwen2.5-coder:0.5b"
 *   - Every entry in OLLAMA_AUTO_MODELS is <=1.5B and Ollama-only
 *   - FALLBACK_MAP only maps <=1.5B -> <=1.5B
 *   - PROVIDER_DEFAULTS only reference <=1.5B Ollama models
 *   - MLC (WebLLM) models (>1.5B) are structurally excluded from ALL auto paths
 */

// ===========================================================================
// Ollama auto models — always <=1.5B, always with "ollama/" prefix
// ===========================================================================

export const OLLAMA_AUTO_MODELS = [
  {
    id: 'ollama/qwen2.5-coder:0.5b',
    name: 'Qwen 2.5 Coder 0.5B',
    size: '397 MB',
    runtime: 'Ollama' as const,
    description:
      'Smallest capable coder model. Fastest option (live-tested 2026-08-10, Q4_K_M, 494M params, ~0.5-1s latency). Requires Ollama.',
  },
  {
    id: 'ollama/qwen2.5-coder:1.5b',
    name: 'Qwen 2.5 Coder 1.5B',
    size: '986 MB',
    runtime: 'Ollama' as const,
    description:
      'Lightweight coder with better reasoning (live-tested 2026-08-10, Q4_K_M, 1.5B params). Requires Ollama.',
  },
  {
    id: 'ollama/llama3.2:1b',
    name: 'Llama 3.2 1B',
    size: '1.3 GB',
    runtime: 'Ollama' as const,
    description:
      "Meta's smallest instruct model (Q8_0 quantization; larger disk than Q4 variants). Requires Ollama.",
  },
  {
    id: 'ollama/qwen2.5:0.5b',
    name: 'Qwen 2.5 0.5B',
    size: '397 MB',
    runtime: 'Ollama' as const,
    description:
      'Smallest general model (live-tested 2026-08-10, Q4_K_M, 494M params). Requires Ollama.',
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
] as const; // Phi-3.5 Mini removed from defaults — only available via manual model config

// ===========================================================================
// Combined recommended models list (for UI display)
// ===========================================================================

export const RECOMMENDED_MODELS = [
  ...OLLAMA_AUTO_MODELS,
  ...MLC_EXPERT_MODELS,
] as const;

export type RecommendedModelId = (typeof RECOMMENDED_MODELS)[number]['id'];

// ===========================================================================
// Default model — the smallest, fastest Ollama model
// ===========================================================================

/** The model auto-selected on first run / when no user preference is stored. */
export const DEFAULT_MODEL = 'ollama/qwen2.5-coder:0.5b';

// ===========================================================================
// Fallback map — model-ID -> fallback model ID (both <=1.5B Ollama)
// ===========================================================================

/**
 * Maps small Ollama models to their next-larger counterpart.
 * Both key and value must be <=1.5B. No >1.5B model appears here.
 */
export const FALLBACK_MAP: Record<string, string> = {
  'qwen2.5-coder:0.5b': 'ollama/qwen2.5-coder:1.5b',
  'qwen2.5:0.5b': 'ollama/qwen2.5:1.5b',
};

/**
 * The default fallback model when the primary is unknown but not already the fallback.
 */
export const DEFAULT_FALLBACK_MODEL_ID = 'ollama/qwen2.5-coder:1.5b';

// ===========================================================================
// Provider defaults — per-provider default model IDs
// ===========================================================================

/**
 * Default models per provider.
 * Ollama defaults to the smallest tested model (<=0.5B).
 * WebLLM has no default — all WebLLM models are >1.5B and require explicit user selection.
 */
export const PROVIDER_DEFAULT_MODELS: Record<string, string | undefined> = {
  ollama: DEFAULT_MODEL,
  webllm: undefined,
};

export type ProviderType = 'ollama' | 'webllm';

// ===========================================================================
// Auto-onboarding default resolution
// ===========================================================================

/**
 * Resolve the default model ID for onboarding/first-run.
 * Returns undefined only if the provider has no auto-default (WebLLM).
 */
export function resolveOnboardingDefaultModel(provider: ProviderType): string | undefined {
  return PROVIDER_DEFAULT_MODELS[provider];
}

/**
 * Enumeration of every model ID that can appear in any automatic/default/fallback path.
 * Used by invariant tests and the audit script to verify <=1.5B Ollama-only constraint.
 */
export function enumerateAutoModelIds(): string[] {
  const ids = new Set<string>();

  // 1. DEFAULT_MODEL
  ids.add(DEFAULT_MODEL);

  // 2. All OLLAMA_AUTO_MODELS
  for (const m of OLLAMA_AUTO_MODELS) {
    ids.add(m.id);
  }

  // 3. Fallback map values
  for (const v of Object.values(FALLBACK_MAP)) {
    ids.add(v);
  }

  // 4. Provider defaults
  for (const v of Object.values(PROVIDER_DEFAULT_MODELS)) {
    if (v) ids.add(v);
  }

  // 5. DEFAULT_FALLBACK_MODEL_ID
  ids.add(DEFAULT_FALLBACK_MODEL_ID);

  return [...ids];
}

/**
 * Enumeration of every expert-only model ID (>1.5B, never auto-selected).
 */
export function enumerateExpertModelIds(): string[] {
  return MLC_EXPERT_MODELS.map((m) => m.id);
}

/**
 * Check if a model ID is ≤1.5B and has no >1.5B segments in its name.
 */
export function isModelAutoAllowed(modelId: string): boolean {
  const bare = modelId.replace(/^ollama\//, '');
  const sizeMatch = bare.match(/:(\d+(?:\.\d+)?)b/i);
  if (sizeMatch) {
    return parseFloat(sizeMatch[1]!) <= 1.5;
  }
  // Also check for MLC-style size embedded in name
  const mlcMatch = bare.match(/(\d+)B/);
  if (mlcMatch) {
    return parseFloat(mlcMatch[1]!) <= 1.5;
  }
  return false;
}
