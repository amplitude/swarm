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
  'SmolLM2-135M-Instruct-q0f16-MLC': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: true,
    maxContextTokens: 4096,
    toolCallFormat: 'json-text',
  },
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
  'Phi-3.5-mini-instruct-q4f16_1-MLC': {
    supportsNativeFunctionCalling: false,
    supportsSystemPromptWithTools: true,
    maxContextTokens: 4096,
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
  const bareId = modelId.replace(/^ollama\//, '');

  const mlcCaps = MLC_MODEL_CAPABILITIES[modelId];
  if (mlcCaps) return maybeDowngrade(modelId, mlcCaps);

  const mlcCapsBare = MLC_MODEL_CAPABILITIES[bareId];
  if (mlcCapsBare) return maybeDowngrade(modelId, mlcCapsBare);

  for (const { pattern, capabilities } of FALLBACK_PATTERNS) {
    if (pattern.test(bareId) || pattern.test(modelId)) return maybeDowngrade(modelId, capabilities);
  }

  return CONSERVATIVE_DEFAULT;
}

export function recordToolCallingFailure(modelId: string): void {
  const count = (failureCounts.get(modelId) ?? 0) + 1;
  failureCounts.set(modelId, count);
  if (count >= FAILURE_THRESHOLD) {
    console.warn(`Model "${modelId}" failed native tool calling ${count} times. Auto-downgrading to text-based tool calling.`);
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

export function getModelEstimatedBytes(modelId: string): number {
  const mlcSizes: Record<string, number> = {
    'SmolLM2-135M-Instruct-q0f16-MLC': 180 * 1024 * 1024,           // ~180 MB download
    'SmolLM2-360M-Instruct-q4f16_1-MLC': 200 * 1024 * 1024,         // ~200 MB
    'Qwen3-8B-q4f16_1-MLC': 5 * 1024 * 1024 * 1024,
    'Qwen3-4B-q4f16_1-MLC': 3 * 1024 * 1024 * 1024,
    'Hermes-3-Llama-3.1-8B-q4f16_1-MLC': 4 * 1024 * 1024 * 1024,
    'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC': 4 * 1024 * 1024 * 1024,
    'Llama-3.1-8B-Instruct-q4f16_1-MLC': 4 * 1024 * 1024 * 1024,
    'Phi-3.5-mini-instruct-q4f16_1-MLC': 2 * 1024 * 1024 * 1024,
  };
  return mlcSizes[modelId] ?? 180 * 1024 * 1024;
}
