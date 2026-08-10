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
// Recommended models — centralized in model-constants.ts
// ---------------------------------------------------------------------------

export {
  OLLAMA_AUTO_MODELS,
  MLC_EXPERT_MODELS,
  RECOMMENDED_MODELS,
  DEFAULT_MODEL,
  DEFAULT_FALLBACK_MODEL_ID,
  FALLBACK_MAP,
  PROVIDER_DEFAULT_MODELS,
  enumerateAutoModelIds,
  enumerateExpertModelIds,
  isModelAutoAllowed,
} from './model-constants';

export type { RecommendedModelId } from './model-constants';

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
