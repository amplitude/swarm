/**
 * model-constants.ts — SINGLE source of truth for all automatic/default model IDs.
 *
 * Every automatic model literal, fallback mapping, provider default, and
 * auto-onboarding resolution MUST import from this module. No module in the
 * project may hardcode a model ID intended for automatic selection.
 *
 * NEW DEFAULT (zero-setup): WebLLM + SmolLM2-360M-Instruct-q4f16_1-MLC.
 * Browser downloads/caches the model automatically; no API key, no paid API.
 * Quality is intentionally low.
 *
 * Invariants enforced by auto-model-invariant.test.ts:
 *   - DEFAULT_MODEL is "SmolLM2-360M-Instruct-q4f16_1-MLC" (verified installed in @mlc-ai/web-llm)
 *   - MLC_AUTO_MODELS are <=360M params, WebLLM runtime (no Ollama required)
 *   - OLLAMA_AUTO_MODELS are <=0.5B, require Ollama, manually selected only
 *   - FALLBACK_MAP only used when Ollama is explicitly selected
 *   - PROVIDER_DEFAULTS: webllm gets SmolLM2-360M, ollama gets smollm2:135m
 *   - MLC_EXPERT_MODELS (>1.5B) are structurally excluded from ALL auto paths
 */
// ===========================================================================
// MLC (WebLLM) auto models — <=360M params, WebGPU browser inference
// Zero-setup: browser downloads/caches automatically; no API key needed.
// ===========================================================================

export const MLC_AUTO_MODELS = [
  {
    id: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
    name: 'SmolLM2 360M',
    size: '~376 MB',
    runtime: 'WebLLM' as const,
    description:
      'Verified smallest chat/instruct model in @mlc-ai/web-llm v0.2.82 (376 MB VRAM, 360M params). Intentionally low quality — zero-setup default. Browser downloads once, caches automatically. Requires WebGPU (Chrome 113+). No API key, no paid API.',
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
// Ollama models — always <=0.5B, always with "ollama/" prefix
// Available only after explicit provider selection in advanced settings.
// ===========================================================================

export const OLLAMA_AUTO_MODELS = [
  {
    id: 'ollama/smollm2:135m',
    name: 'SmolLM2 135M',
    size: '258 MB',
    runtime: 'Ollama' as const,
    description:
      'Smallest practical Ollama model (live-measured 258 MB, F16, 135M params). Requires Ollama. Expert mode only.',
  },
  {
    id: 'ollama/qwen2.5-coder:0.5b',
    name: 'Qwen 2.5 Coder 0.5B',
    size: '397 MB',
    runtime: 'Ollama' as const,
    description:
      'Smallest capable coder model. Requires Ollama. Expert mode only.',
  },
  {
    id: 'ollama/qwen2.5:0.5b',
    name: 'Qwen 2.5 0.5B',
    size: '397 MB',
    runtime: 'Ollama' as const,
    description:
      'Smallest general model. Requires Ollama. Expert mode only.',
  },
] as const;

// ===========================================================================
// Combined recommended models list (for UI display)
// Order: auto WebLLM (default) → expert WebLLM → Ollama (expert only)
// ===========================================================================

export const RECOMMENDED_MODELS = [
  ...MLC_AUTO_MODELS,
  ...MLC_EXPERT_MODELS,
  ...OLLAMA_AUTO_MODELS,
] as const;

export type RecommendedModelId = (typeof RECOMMENDED_MODELS)[number]['id'];

// ===========================================================================
// Default model — SmolLM2-360M-Instruct-q4f16_1-MLC (zero-setup WebLLM)
// ===========================================================================

/** The model auto-selected on first run / when no user preference is stored. */
export const DEFAULT_MODEL = 'SmolLM2-360M-Instruct-q4f16_1-MLC';

// ===========================================================================
// Fallback map — used only when Ollama is explicitly selected
// ===========================================================================

/**
 * Maps small Ollama models to their next-larger counterpart.
 * Only used when Ollama provider is explicitly selected.
 */
export const FALLBACK_MAP: Record<string, string> = {
  'smollm2:135m': 'ollama/qwen2.5-coder:0.5b',
};

/**
 * The default fallback model when the primary is unknown but not already the fallback.
 * Only used when Ollama provider is explicitly selected.
 */
export const DEFAULT_FALLBACK_MODEL_ID = 'ollama/qwen2.5-coder:0.5b';

// ===========================================================================
// Provider defaults — per-provider default model IDs
// ===========================================================================

/**
 * Default models per provider.
 * WebLLM defaults to SmolLM2-360M-Instruct-q4f16_1-MLC (zero-setup, no API key).
 * Ollama defaults to smollm2:135m (smallest Ollama model, expert mode only).
 */
export const PROVIDER_DEFAULT_MODELS: Record<string, string | undefined> = {
  webllm: DEFAULT_MODEL,
  ollama: 'ollama/smollm2:135m',
};

export type ProviderType = 'ollama' | 'webllm';

// ===========================================================================
// Auto-onboarding default resolution
// ===========================================================================

/**
 * Resolve the default model ID for onboarding/first-run.
 * Both providers now have defaults (WebLLM is the main path).
 */
export function resolveOnboardingDefaultModel(provider: ProviderType): string | undefined {
  return PROVIDER_DEFAULT_MODELS[provider];
}

// ===========================================================================
// Migration support — old implicit Ollama default → new WebLLM default
// ===========================================================================

/** The old DEFAULT_MODEL value before zero-setup migration. */
export const OLD_IMPLICIT_DEFAULT_MODEL = 'ollama/smollm2:135m';

/** The old implicit default provider. */
export const OLD_IMPLICIT_DEFAULT_PROVIDER = 'ollama';

/**
 * Check whether the given provider/model pair represents an old implicit default
 * (user never explicitly chose Ollama — just got the hardcoded default).
 * Used in migration logic to convert old profiles to the new WebLLM default
 * without overriding a genuinely explicit Ollama setting.
 */
export function isOldImplicitDefault(provider: string | null, modelId: string | null): boolean {
  // If user explicitly set a non-default model, it's explicit
  if (modelId && modelId !== OLD_IMPLICIT_DEFAULT_MODEL) return false;
  // If provider is the old default and model is the old default, it's the implicit pair
  return provider === OLD_IMPLICIT_DEFAULT_PROVIDER && modelId === OLD_IMPLICIT_DEFAULT_MODEL;
}

// ===========================================================================
// Enumeration helpers
// ===========================================================================

/**
 * Enumeration of every model ID that can appear in any automatic/default/fallback path.
 */
export function enumerateAutoModelIds(): string[] {
  const ids = new Set<string>();

  // 1. DEFAULT_MODEL
  ids.add(DEFAULT_MODEL);

  // 2. All MLC_AUTO_MODELS
  for (const m of MLC_AUTO_MODELS) {
    ids.add(m.id);
  }

  // 3. All OLLAMA_AUTO_MODELS
  for (const m of OLLAMA_AUTO_MODELS) {
    ids.add(m.id);
  }

  // 4. Provider defaults
  for (const v of Object.values(PROVIDER_DEFAULT_MODELS)) {
    if (v) ids.add(v);
  }

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
 * WebLLM models <=360M params and Ollama models <=0.5B are auto-allowed.
 */
export function isModelAutoAllowed(modelId: string): boolean {
  const bare = modelId.replace(/^ollama\//, '');

  // Handle '135m' / '360m' pattern — treat as <=0.5B
  const smMatch = bare.match(/^SmolLM2-(\d+)M/i);
  if (smMatch) {
    const mbSize = parseInt(smMatch[1]!, 10);
    return mbSize <= 360;
  }

  // Handle '135m' pattern via ":" separator (ollama style)
  const colonSmMatch = bare.match(/:(\d+)m/i);
  if (colonSmMatch) {
    const mbSize = parseInt(colonSmMatch[1]!.replace(':', '').replace('m', ''), 10);
    return mbSize <= 500;
  }

  // Handle '0.5b' pattern
  const sizeMatch = bare.match(/:\d+(?:\.\d+)?b/i);
  if (sizeMatch) {
    const size = parseFloat(sizeMatch[0]!.replace(':', '').replace('b', ''));
    return size <= 0.5;
  }

  // Handle MLC-style size embedded in name (e.g. Qwen3-8B, SmolLM2-360M)
  // SmolLM2-360M is already handled above
  const mlcMatch = bare.match(/(\d+)B/);
  if (mlcMatch) {
    return parseFloat(mlcMatch[1]!) <= 0.5;
  }

  return false;
}
