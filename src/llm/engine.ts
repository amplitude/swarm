import type { LLMFunctionDef } from '@/types/tool';

export interface LLMRequest {
  messages: Array<{ role: string; content: string; tool_call_id?: string }>;
  tools?: LLMFunctionDef[];
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface LLMToolCall {
  id: string;
  function: {
    name: string;
    arguments: string;
  };
}

export interface LLMStreamChunk {
  content?: string;
  toolCalls?: LLMToolCall[];
  finishReason?: string | null;
}

export interface LLMProvider {
  load(modelId: string, onProgress?: (progress: number, text: string) => void): Promise<void>;
  generate(request: LLMRequest): AsyncGenerator<LLMStreamChunk>;
  isLoaded(): boolean;
  unload(): Promise<void>;
  getLoadedModel(): string | null;
}

// ---------------------------------------------------------------------------
// Recommended models
// ---------------------------------------------------------------------------

// Ollama models (primary — fast, cheap, local)
const OLLAMA_MODELS = [
  {
    id: 'ollama/qwen2.5-coder:0.5b',
    name: 'Qwen 2.5 Coder 0.5B',
    size: '397 MB',
    runtime: 'Ollama',
    description: 'Smallest capable coder model. Fastest option (live-tested 2026-08-10, Q4_K_M, 494M params, ~0.5-1s latency). Requires Ollama.',
  },
  {
    id: 'ollama/qwen2.5-coder:1.5b',
    name: 'Qwen 2.5 Coder 1.5B',
    size: '986 MB',
    runtime: 'Ollama',
    description: 'Lightweight coder with better reasoning (live-tested 2026-08-10, Q4_K_M, 1.5B params). Requires Ollama.',
  },
  {
    id: 'ollama/llama3.2:1b',
    name: 'Llama 3.2 1B',
    size: '1.3 GB',
    runtime: 'Ollama',
    description: 'Meta\'s smallest instruct model (Q8_0 quantization; larger disk than Q4 variants). Requires Ollama.',
  },
  {
    id: 'ollama/qwen2.5:0.5b',
    name: 'Qwen 2.5 0.5B',
    size: '397 MB',
    runtime: 'Ollama',
    description: 'Smallest general model (live-tested 2026-08-10, Q4_K_M, 494M params). Requires Ollama.',
  },
] as const;

// WebLLM models (browser-native via WebGPU — requires explicit user selection; >1.5B, never auto-selected)
const MLC_MODELS = [
  {
    id: 'Qwen3-8B-q4f16_1-MLC',
    name: 'Qwen 3 8B',
    size: '~5 GB',
    runtime: 'WebLLM',
    description: 'Best for agents. Strong instruction following and tool use via text. WebGPU required. >1.5B — manually selected only.',
  },
  {
    id: 'Qwen3-4B-q4f16_1-MLC',
    name: 'Qwen 3 4B',
    size: '~3 GB',
    runtime: 'WebLLM',
    description: 'Lightweight and capable. Good tool calling for its size. WebGPU required. >1.5B — manually selected only.',
  },
] as const;  // Phi-3.5 Mini (3.8B) removed from defaults — only available via explicit model config

export const RECOMMENDED_MODELS = [...OLLAMA_MODELS, ...MLC_MODELS] as const;

export type RecommendedModelId = (typeof RECOMMENDED_MODELS)[number]['id'];

// Default: Ollama with the smallest coder model
export const DEFAULT_MODEL = 'ollama/qwen2.5-coder:0.5b';

// ---------------------------------------------------------------------------
// WebGPU detection (still needed for WebLLM fallback path)
// ---------------------------------------------------------------------------

export async function checkWebGPUSupport(): Promise<{ supported: boolean; error?: string }> {
  if (!navigator.gpu) {
    return {
      supported: false,
      error: 'WebGPU is not supported in this browser. Please use Chrome 113+, Edge 113+, or another WebGPU-enabled browser.',
    };
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        error: 'No WebGPU adapter found. Your GPU may not be supported.',
      };
    }
    return { supported: true };
  } catch {
    return {
      supported: false,
      error: 'Failed to initialize WebGPU. Please ensure your GPU drivers are up to date.',
    };
  }
}
