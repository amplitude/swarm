import type { LLMProvider, LLMRequest, LLMStreamChunk } from './engine';

/**
 * TestProvider — deterministic, zero-download LLM provider for E2E testing.
 * Only available under VITE_TEST_MODE build flag.
 * Tree-shaken in production builds.
 */
export class TestProvider implements LLMProvider {
  private loaded = false;
  private modelId: string | null = null;

  async load(modelId: string, onProgress?: (progress: number, text: string) => void): Promise<void> {
    onProgress?.(1, 'Test mode');
    this.loaded = true;
    this.modelId = modelId;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getLoadedModel(): string | null {
    return this.modelId;
  }

  async unload(): Promise<void> {
    this.loaded = false;
    this.modelId = null;
  }

  async *generate(_request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    if (!this.loaded) throw new Error('TestProvider not loaded');

    const response = 'This is a test response from the TestProvider.';

    // Stream character by character for realistic feel
    for (const char of response) {
      yield { content: char };
    }
    yield { finishReason: 'stop' };
  }
}
