export interface ModelCapabilities {
  supportsNativeFunctionCalling: boolean;
  supportsSystemPromptWithTools: boolean;
  maxContextTokens: number;
  toolCallFormat: 'native' | 'json-text' | 'none';
}

const CONSERVATIVE_DEFAULT: ModelCapabilities = {
  supportsNativeFunctionCalling: false,
  supportsSystemPromptWithTools: true,
  maxContextTokens: 4096,
  toolCallFormat: 'json-text',
};

// ---------------------------------------------------------------------------
// MLC (WebLLM) model capabilities
// ---------------------------------------------------------------------------

const MLC_MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  'SmolLM2-360M-Instruct-q4f16_1-MLC': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: true,
    maxContextTokens: 4096,
    toolCallFormat: 'json-text',
  },
  'Qwen3-8B-q4f16_1-MLC': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: true,
    maxContextTokens: 32768,
    toolCallFormat: 'json-text',
  },
  'Qwen3-4B-q4f16_1-MLC': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: true,
    maxContextTokens: 32768,
    toolCallFormat: 'json-text',
  },
  'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC': {
    supportsNativeFunctionCalling: true,
    supportsSystemPromptWithTools: false,
    maxContextTokens: 8192,
    toolCallFormat: 'json-text',
  },
  'Hermes-3-Llama-3.1-8B-q4f16_1-MLC': {
    supportsNativeFunctionCalling: true,
    supportsSystemPromptWithTools: false,
    maxContextTokens: 8192,
    toolCallFormat: 'json-text',
  },
  'Llama-3.1-8B-Instruct-q4f16_1-MLC': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: true,
    maxContextTokens: 8192,
    toolCallFormat: 'json-text',
  },
  // Phi-3.5 Mini (3.8B, ~2 GB) — kept for capability recognition when explicitly configured by user.
  // Not auto-selected per design: all automatic defaults are <=360M WebLLM or <=0.5B Ollama.
  'Phi-3.5-mini-instruct-q4f16_1-MLC': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: true,
    maxContextTokens: 4096,
    toolCallFormat: 'json-text',
  },
};

// ---------------------------------------------------------------------------
// Ollama model capabilities (keyed by the bare model name, without ollama/ prefix)
// ---------------------------------------------------------------------------

const OLLAMA_MODEL_CAPABILITIES: Record<string, ModelCapabilities> = {
  'smollm2:135m': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: false,
    maxContextTokens: 2048,
    toolCallFormat: 'none',
  },
  'qwen2.5-coder:0.5b': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: true,
    maxContextTokens: 32768,
    toolCallFormat: 'json-text',
  },
  'qwen2.5-coder:1.5b': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: true,
    maxContextTokens: 32768,
    toolCallFormat: 'json-text',
  },
  'qwen2.5:0.5b': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: true,
    maxContextTokens: 32768,
    toolCallFormat: 'json-text',
  },
  'llama3.2:1b': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: true,
    maxContextTokens: 8192,
    toolCallFormat: 'json-text',
  },
  'llama3.2:3b': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: true,
    maxContextTokens: 8192,
    toolCallFormat: 'json-text',
  },
  // phi3 models (>1.5B) — kept for capability recognition when explicitly configured.
  // Not auto-selected.
  'phi3:mini': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: true,
    maxContextTokens: 4096,
    toolCallFormat: 'json-text',
  },
  'phi3.5:3.8b': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: true,
    maxContextTokens: 8192,
    toolCallFormat: 'json-text',
  },
};

// Fallback patterns for unknown models
const FALLBACK_PATTERNS: Array<{ pattern: RegExp; capabilities: ModelCapabilities }> = [
  {
    pattern: /qwen/i,
    capabilities: {
      supportsNativeFunctionCalling: false,
      supportsSystemPromptWithTools: true,
      maxContextTokens: 32768,
      toolCallFormat: 'json-text',
    },
  },
  {
    pattern: /hermes/i,
    capabilities: {
      supportsNativeFunctionCalling: true,
      supportsSystemPromptWithTools: false,
      maxContextTokens: 8192,
      toolCallFormat: 'json-text',
    },
  },
];

/** Session-level failure tracking for auto-downgrade */
const failureCounts = new Map<string, number>();
const FAILURE_THRESHOLD = 3;

export function getModelCapabilities(modelId: string): ModelCapabilities {
  // Remove "ollama/" prefix if present
  const bareId = modelId.replace(/^ollama\//, '');

  // Check Ollama model capabilities
  const ollamaCaps = OLLAMA_MODEL_CAPABILITIES[bareId];
  if (ollamaCaps) {
    return maybeDowngrade(modelId, ollamaCaps);
  }

  // Check MLC model capabilities (using full modelId for MLC models)
  const mlcCaps = MLC_MODEL_CAPABILITIES[modelId];
  if (mlcCaps) {
    return maybeDowngrade(modelId, mlcCaps);
  }

  // Check MLC by bare name
  const mlcCapsBare = MLC_MODEL_CAPABILITIES[bareId];
  if (mlcCapsBare) {
    return maybeDowngrade(modelId, mlcCapsBare);
  }

  // Fallback patterns
  for (const { pattern, capabilities } of FALLBACK_PATTERNS) {
    if (pattern.test(bareId) || pattern.test(modelId)) {
      return maybeDowngrade(modelId, capabilities);
    }
  }

  return CONSERVATIVE_DEFAULT;
}

export function recordToolCallingFailure(modelId: string): void {
  const count = (failureCounts.get(modelId) ?? 0) + 1;
  failureCounts.set(modelId, count);
  if (count >= FAILURE_THRESHOLD) {
    console.warn(
      `Model "${modelId}" failed native tool calling ${count} times. ` +
      `Auto-downgrading to text-based tool calling for this session.`,
    );
  }
}

function maybeDowngrade(modelId: string, caps: ModelCapabilities): ModelCapabilities {
  const count = failureCounts.get(modelId) ?? 0;
  if (count >= FAILURE_THRESHOLD && caps.toolCallFormat === 'native') {
    return { ...caps, supportsNativeFunctionCalling: false, toolCallFormat: 'json-text' };
  }
  return caps;
}

// ---------------------------------------------------------------------------
// Model size estimation (for storage checks)
// ---------------------------------------------------------------------------

/**
 * Estimated download bytes for known models.
 *
 * NOTE: These are MLC-reported estimates from the prebuiltAppConfig, not measured.
 * No live smoke tests have been run on WebLLM/MLC models — WebGPU is not available
 * in this test environment.
 *
 * SmolLM2-360M-Instruct-q4f16_1-MLC: 376 MB VRAM reported, estimated ~200 MB download
 * (q4f16_1 quantization is aggressive, 360M params at 2 bytes/param ≈ 720 MB full,
 * q4 ≈ 180 MB, plus overhead ≈ 200 MB).
 *
 * Ollama model sizes return 0 because they are handled by the local Ollama service,
 * not downloaded by the browser.
 */
export function getModelEstimatedBytes(modelId: string): number {
  // Ollama models are downloaded by Ollama itself, not by the browser
  if (modelId.startsWith('ollama/')) {
    return 0;
  }

  // MLC models — approximate sizes from registry (modelled, not measured via live smoke test)
  const mlcSizes: Record<string, number> = {
    'SmolLM2-360M-Instruct-q4f16_1-MLC': 200 * 1024 * 1024,         // ~200 MB — smallest default
    'Qwen3-8B-q4f16_1-MLC': 5 * 1024 * 1024 * 1024,
    'Qwen3-4B-q4f16_1-MLC': 3 * 1024 * 1024 * 1024,
    'Hermes-3-Llama-3.1-8B-q4f16_1-MLC': 4 * 1024 * 1024 * 1024,
    'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC': 4 * 1024 * 1024 * 1024,
    'Llama-3.1-8B-Instruct-q4f16_1-MLC': 4 * 1024 * 1024 * 1024,
    'Phi-3.5-mini-instruct-q4f16_1-MLC': 2 * 1024 * 1024 * 1024,
  };

  return mlcSizes[modelId] ?? 200 * 1024 * 1024; // fallback to 200 MB for unknown small models
}
