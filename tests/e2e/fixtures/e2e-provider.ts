/**
 * E2E Test Provider — deterministic, async, streaming LLM provider for
 * Playwright browser tests only.
 *
 * IMPORTANT: This file is resolved ONLY when Vite runs with `mode=e2e`.
 * The Vite config aliases `src/llm/web-llm-provider.ts` → this file during
 * e2e builds. Normal production / dev builds never import or bundle this
 * module.
 *
 * Features:
 * - Real async load progress (0 → 1 over ~600ms)
 * - Streamed token chunks character-by-character
 * - AbortSignal support — stops mid-stream
 * - Prompt-aware deterministic output parsed by CompatibilityLayer:
 *   - "[e2e stop]" → triggers "STOPPED" mid-stream
 *   - "[e2e error]" → throws during generation
 *   - "[e2e handoff]" → tool_call JSON parseable by parseToolCalls
 *   - "[e2e tools]" → create_task tool_call JSON
 *   - all other prompts → deterministic response seeded by prompt text
 */

import type { LLMProvider, LLMRequest, LLMStreamChunk } from '../../../src/llm/engine';

const E2E_MARKER = '__E2E_PROVIDER__';

/**
 * WebGPU availability message constants — same shape as the real module
 * so nothing breaks if any import references them.
 */
export const WEBGPU_UNAVAILABLE_MSG = 'WebGPU is not available — E2E mode';
export const WEBGPU_NO_ADAPTER_MSG = 'No WebGPU adapter — E2E mode';

// ── Deterministic response generator ──────────────────────────────────────

function determineResponse(messages: LLMRequest['messages']): string {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user');
  const text = lastUser?.content ?? '';

  if (text.includes('[e2e stop]')) {
    return 'STOPPED';
  }
  if (text.includes('[e2e error]')) {
    throw new Error('Simulated E2E generation error');
  }
  if (text.includes('[e2e handoff]')) {
    const targetAgent = text.includes('coder') ? 'coder' : 'general';
    return JSON.stringify({
      tool_call: {
        name: 'handoff_to_agent',
        arguments: {
          target_agent: targetAgent,
          reason: text.includes('reason')
            ? 'User requested handoff to test persistence'
            : 'Automated E2E handoff test',
          context: text.includes('context')
            ? 'Here is the context from the previous conversation'
            : undefined,
        },
      },
    });
  }
  if (text.includes('[e2e tools]')) {
    return JSON.stringify({
      tool_call: {
        name: 'create_task',
        arguments: {
          title: 'E2E Test Task',
          description: 'Created by E2E tool call',
        },
      },
    });
  }
  if (text.includes('[e2e empty]')) {
    return '';
  }

  // Generate a deterministic response based on prompt text
  const seed = text.length > 0 ? text.charCodeAt(0) + text.length : 42;
  const words = [
    'Here', 'is', 'a', 'deterministic', 'response', 'from', 'the',
    'E2E', 'provider', 'for', 'testing', 'purposes',
  ];
  const count = 4 + (seed % 8);
  let response = '';
  for (let i = 0; i < count; i++) {
    const idx = (seed + i * 7) % words.length;
    response += (i > 0 ? ' ' : '') + words[idx]!;
  }
  response += '.';
  return response;
}

// ── Provider ──────────────────────────────────────────────────────────────

export class E2EProvider implements LLMProvider {
  private _loaded = false;
  private _modelId: string | null = null;
  private _aborted = false;

  async load(
    modelId: string,
    onProgress?: (progress: number, text: string) => void,
  ): Promise<void> {
    this._aborted = false;
    // Simulate realistic async load progress
    const steps = [0, 0.1, 0.25, 0.4, 0.55, 0.7, 0.85, 0.95, 1.0];
    for (const step of steps) {
      if (this._aborted) throw new DOMException('Aborted', 'AbortError');
      await new Promise((r) => setTimeout(r, 75));
      onProgress?.(step, `E2E load: ${Math.round(step * 100)}%`);
    }
    this._loaded = true;
    this._modelId = modelId;
  }

  isLoaded(): boolean {
    return this._loaded;
  }

  getLoadedModel(): string | null {
    return this._modelId;
  }

  async unload(): Promise<void> {
    this._loaded = false;
    this._modelId = null;
    this._aborted = false;
  }

  async abort(): Promise<void> {
    this._aborted = true;
  }

  async *generate(request: LLMRequest): AsyncGenerator<LLMStreamChunk> {
    if (!this._loaded) throw new Error(`${E2E_MARKER} not loaded`);

    let response: string;
    try {
      response = determineResponse(request.messages);
    } catch (e) {
      yield { content: `[Error: ${(e as Error).message}]`, finishReason: 'stop' };
      return;
    }

    // Stream character by character with realistic delays
    for (let i = 0; i < response.length; i++) {
      if (this._aborted) {
        yield { finishReason: 'stop' };
        return;
      }
      await new Promise((r) => setTimeout(r, 15));
      yield { content: response[i]! };
    }

    yield { finishReason: 'stop' };
  }
}

// Re-export as WebLLMProvider so the alias in provider-singleton works
export const WebLLMProvider = E2EProvider;

// ── Factory singleton ─────────────────────────────────────────────────────

let instance: E2EProvider | null = null;

export function getE2EProvider(): E2EProvider {
  if (!instance) {
    instance = new E2EProvider();
  }
  return instance;
}

export function resetE2EProvider(): void {
  if (instance) {
    instance.unload().catch(() => {});
    instance = null;
  }
}
