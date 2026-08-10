import type { LLMProvider, LLMRequest, LLMStreamChunk } from './engine';

/**
 * DemoProvider — deterministic, zero-download, zero-API LLM provider.
 *
 * Used when:
 * - WebGPU is unavailable in the browser
 * - WebLLM initialization fails
 * - User dismisses model download
 *
 * Returns canned responses. Never makes network requests.
 * Clearly identified as "Demo Mode" — no output claims to be AI-generated.
 * The CompatibilityLayer wraps this, so tool calls and adaptive requests
 * still flow through the normal pipeline.
 */

// Canned responses keyed by prompt patterns
const CANNED_RESPONSES: Array<{ pattern: RegExp; response: string }> = [
  {
    pattern: /hello|hi|hey|greetings/i,
    response: 'Hello! This is Demo Mode — no AI model is loaded. The UI is fully functional for testing layout, navigation, and interactions.',
  },
  {
    pattern: /who are you|what are you|what is this/i,
    response: 'This is Swarm running in Demo Mode. No WebLLM model is loaded and no API key is configured. All responses are pre-written templates. To enable AI inference, make sure your browser supports WebGPU (Chrome 113+) and click "Retry WebLLM" in the status bar, or configure Ollama in advanced settings.',
  },
  {
    pattern: /help|commands|what can/i,
    response: 'In Demo Mode, you can explore the full UI: create conversations, switch agents (Cmd+1-5), open settings, and test the builder/canvas. AI responses are static templates. To get actual AI output, ensure WebGPU is available and retry WebLLM from the status bar.',
  },
  {
    pattern: /test|check|status|health/i,
    response: 'Demo Mode active. WebLLM is not loaded. All UI components are functional. Storage: browser IndexedDB available for persistence. Navigation: all agents and panels work.',
  },
  {
    pattern: /code|javascript|function|program/i,
    response: 'To execute code in Demo Mode, use the code execution tools in the UI. The sandbox (QuickJS WASM) runs independently of the LLM and is available even without a model loaded. Try asking the Coder agent to run JavaScript.',
  },
];

const DEFAULT_RESPONSE = 'Swarm is running in Demo Mode. The AI model is not loaded, so responses are static templates. You can still navigate the full UI, create conversations, and test all components. To enable AI: ensure WebGPU (Chrome 113+) is available and retry WebLLM from the status bar, or configure Ollama in advanced settings.';

function getCannedResponse(prompt: string): string {
  for (const { pattern, response } of CANNED_RESPONSES) {
    if (pattern.test(prompt)) {
      return response;
    }
  }
  return DEFAULT_RESPONSE;
}

export class DemoProvider implements LLMProvider {
  private loaded: boolean = false;

  async load(
    _modelId: string,
    onProgress?: (progress: number, text: string) => void,
  ): Promise<void> {
    // DemoProvider loads instantly — no downloads, no network
    onProgress?.(1, 'Demo Mode (no AI)');
    this.loaded = true;
  }

  isLoaded(): boolean {
    return this.loaded;
  }

  getLoadedModel(): string | null {
    return this.loaded ? 'demo/demo-mode' : null;
  }

  async unload(): Promise<void> {
    this.loaded = false;
  }

  async *generate(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    if (!this.loaded) {
      throw new Error('Demo provider not loaded. Call load() first.');
    }

    if (request.tools && request.tools.length > 0) {
      // For tool requests, yield a canned tool call for code execution
      const codeTool = request.tools.find((t) => t.function.name === 'run_javascript');
      if (codeTool) {
        yield {
          content: 'In Demo Mode, tool execution triggers the sandbox directly. The demo provider yields this as a template.',
        };
        yield {
          finishReason: 'stop',
        };
        return;
      }
    }

    // Build a canned response from the first user message
    const userMessage = request.messages.find((m) => m.role === 'user');
    const prompt = userMessage?.content ?? '';
    const response = getCannedResponse(prompt);

    // Stream the response character by character for realistic feel
    const words = response.split(' ');
    for (let i = 0; i < words.length; i++) {
      const word = words[i]!;
      yield { content: (i > 0 ? ' ' : '') + word };
    }

    yield { finishReason: 'stop' };
  }
}
