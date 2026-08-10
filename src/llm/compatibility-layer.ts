import type { LLMProvider, LLMRequest, LLMStreamChunk } from './engine';
import type { ModelCapabilities } from './model-capabilities';
import { getModelCapabilities, recordToolCallingFailure } from './model-capabilities';
import { buildAdaptiveRequest } from './request-builder';
import { parseToolCalls } from './response-parser';

export class CompatibilityLayer implements LLMProvider {
  private inner: LLMProvider;
  private capabilitiesFn: (modelId: string) => ModelCapabilities;

  constructor(
    inner: LLMProvider,
    capabilitiesFn: (modelId: string) => ModelCapabilities = getModelCapabilities,
  ) {
    this.inner = inner;
    this.capabilitiesFn = capabilitiesFn;
  }

  async load(
    modelId: string,
    onProgress?: (progress: number, text: string) => void,
  ): Promise<void> {
    return this.inner.load(modelId, onProgress);
  }

  async *generate(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    const modelId = this.getLoadedModel();
    if (!modelId) {
      throw new Error('No model loaded. Call load() first.');
    }

    const caps = this.capabilitiesFn(modelId);
    const hasTools = !!(request.tools && request.tools.length > 0);
    const adapted = buildAdaptiveRequest(request, caps);

    // Text-based tool calling is the primary path for all models
    if (hasTools && caps.toolCallFormat === 'json-text') {
      yield* this.textBasedGenerate(adapted, caps);
      return;
    }

    // Native tool calling (Hermes optimization, falls back to text-based on error)
    if (hasTools && caps.toolCallFormat === 'native') {
      try {
        yield* this.inner.generate(adapted);
        return;
      } catch (error) {
        recordToolCallingFailure(modelId);
        console.warn(
          `Native tool calling failed for "${modelId}", falling back to text-based:`,
          error,
        );
        const fallbackCaps: ModelCapabilities = {
          ...caps,
          supportsNativeFunctionCalling: false,
          toolCallFormat: 'json-text',
        };
        const fallbackRequest = buildAdaptiveRequest(request, fallbackCaps);
        yield* this.textBasedGenerate(fallbackRequest, fallbackCaps);
        return;
      }
    }

    // No tools or 'none' format -- pass through
    yield* this.inner.generate(adapted);
  }

  isLoaded(): boolean {
    return this.inner.isLoaded();
  }

  async unload(): Promise<void> {
    return this.inner.unload();
  }

  getLoadedModel(): string | null {
    return this.inner.getLoadedModel();
  }

  private async *textBasedGenerate(
    request: LLMRequest,
    caps: ModelCapabilities,
  ): AsyncGenerator<LLMStreamChunk> {
    // Accumulate full response to parse tool calls from text
    let fullContent = '';
    let lastFinishReason: string | null = null;

    for await (const chunk of this.inner.generate(request)) {
      if (chunk.content) {
        fullContent += chunk.content;
      }
      if (chunk.finishReason) {
        lastFinishReason = chunk.finishReason;
      }
      // Stream content chunks through for UI responsiveness
      yield { content: chunk.content, finishReason: null };
    }

    // Parse tool calls from accumulated text
    const { cleanedContent, toolCalls } = parseToolCalls(fullContent, caps);

    if (toolCalls.length > 0) {
      // Yield a final chunk with parsed tool calls
      yield {
        content: cleanedContent || undefined,
        toolCalls,
        finishReason: 'tool_calls',
      };
    } else {
      // No tool calls found — yield finish reason
      yield {
        finishReason: lastFinishReason ?? 'stop',
      };
    }
  }
}
