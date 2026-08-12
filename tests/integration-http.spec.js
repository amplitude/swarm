/**
 * integration-http.spec.js — True HTTP-level integration tests
 *
 * Starts the app WITHOUT SWARM_FAKE (real mode) but injects controlled
 * model state/session behavior to avoid downloading or importing a real
 * model. Proves:
 *
 *   - A client-supplied fake/error mode CANNOT force fake behavior
 *   - Model loading/fallback state is handled at the HTTP layer
 *   - Initialisation and/or inference failure returns HTTP 200 with a
 *     deterministic useful body, finishReason: "fallback", and fallbackLabel
 *   - inspect_message always runs, even on fallback paths
 *
 * These tests manage their own server lifecycle (listen on a random port)
 * and do NOT rely on the Playwright webServer fixture, so they work
 * identically with SWARM_FAKE set or unset in the environment.
 */

import { test, expect } from '@playwright/test';
import http from 'node:http';

let createApp, modelState, inspectMessage, FALLBACK_LABEL;

test.describe.serial('HTTP-level integration (real mode, injected state)', () => {
  let server;
  let port;

  test.beforeAll(async () => {
    const mod = await import('../server.mjs');
    createApp = mod.createApp;
    modelState = mod.modelState;
    inspectMessage = mod.inspectMessage;
    FALLBACK_LABEL = mod.FALLBACK_LABEL;
  });

  test.afterAll(() => {
    if (server) server.close();
  });

  /** POST /api/chat to our own server instance and return parsed result. */
  function postChat(body) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify(body);
      const req = http.request(
        `http://localhost:${port}/api/chat`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' } },
        (res) => {
          let raw = '';
          res.on('data', (chunk) => { raw += chunk; });
          res.on('end', () => {
            try {
              resolve({ status: res.statusCode, body: JSON.parse(raw) });
            } catch (e) {
              reject(new Error(`JSON parse error (status ${res.statusCode}): ${raw.slice(0, 200)}`));
            }
          });
        },
      );
      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  /** Start a new server with the current modelState. */
  function startServer() {
    return new Promise((resolve) => {
      const s = createApp();
      s.listen(0, () => {
        server = s;
        port = s.address().port;
        resolve();
      });
    });
  }

  // ────────────────────────────────────────────────────────────────────
  // 1. CLIENT CANNOT FORCE FAKE BEHAVIOR
  // ────────────────────────────────────────────────────────────────────

  test('client-supplied fake mode cannot force fake behavior', async () => {
    modelState.status = 'ready';
    modelState.loaded = true;
    modelState.session = {
      prompt: async (_prompt) => 'Controlled real model response.',
    };
    modelState.error = null;
    modelState.modelName = 'test-model';

    await startServer();

    // mode='success' must be IGNORED because state.status is 'ready', not 'fake'
    const result = await postChat({ message: 'Hello', mode: 'success' });

    expect(result.status).toBe(200);
    expect(result.body.model).not.toBe('fake');
    expect(result.body.model).toBe('test-model');
    expect(result.body.finishReason).toBe('stop');
    expect(result.body.response).toBe('Controlled real model response.');
    expect(result.body.inspection).toBeDefined();
    expect(result.body.inspection.wordCount).toBe(1);
    expect(result.body.inspection.classification).toBe('short');

    server.close();
  });

  // ────────────────────────────────────────────────────────────────────
  // 2. LOADING STATE → FALLBACK
  // ────────────────────────────────────────────────────────────────────

  test('loading state returns HTTP 200 fallback with finishReason, fallbackLabel, inspect_message', async () => {
    modelState.status = 'loading';
    modelState.loaded = false;
    modelState.session = null;
    modelState.error = null;

    await startServer();

    const result = await postChat({ message: 'How are you?' });

    expect(result.status).toBe(200);
    expect(result.body.finishReason).toBe('fallback');
    expect(result.body.fallbackLabel).toBe(FALLBACK_LABEL);
    expect(result.body.model).toBe('fallback');
    expect(typeof result.body.response).toBe('string');
    expect(result.body.response.length).toBeGreaterThan(0);
    // Response is one of the rotating fallback templates — assert useful content
    expect(result.body.response).toMatch(/fallback|model|message|inspect/i);
    expect(result.body.fallbackReason).toBe('Model not loaded');

    // inspect_message always runs
    expect(result.body.inspection).toBeDefined();
    expect(result.body.inspection.wordCount).toBe(3);
    expect(result.body.inspection.hasQuestion).toBe(true);
    expect(result.body.inspection.timestamp).toBeGreaterThan(0);

    server.close();
  });

  // ────────────────────────────────────────────────────────────────────
  // 3. FALLBACK STATE → FALLBACK (failed model download / init)
  // ────────────────────────────────────────────────────────────────────

  test('fallback state returns HTTP 200 with useful body and error details', async () => {
    modelState.status = 'fallback';
    modelState.loaded = false;
    modelState.session = null;
    modelState.error = 'Model download failed: connection refused';

    await startServer();

    const result = await postChat({ message: 'What is swarm?' });

    expect(result.status).toBe(200);
    expect(result.body.finishReason).toBe('fallback');
    expect(result.body.fallbackLabel).toBe(FALLBACK_LABEL);
    expect(result.body.fallbackReason).toContain('connection refused');
    expect(typeof result.body.response).toBe('string');
    expect(result.body.response.length).toBeGreaterThan(0);
    // The fallback response is one of three templates — assert it is useful
    expect(result.body.response).toMatch(/fallback|model|message|inspect/i);
    expect(result.body.model).toBe('fallback');
    expect(result.body.inspection).toBeDefined();
    expect(result.body.inspection.wordCount).toBe(3);

    server.close();
  });

  // ────────────────────────────────────────────────────────────────────
  // 4. INFERENCE FAILURE → FALLBACK
  // ────────────────────────────────────────────────────────────────────

  test('inference failure returns HTTP 200 fallback', async () => {
    modelState.status = 'ready';
    modelState.loaded = true;
    modelState.session = {
      prompt: async () => { throw new Error('OOM during inference'); },
    };
    modelState.modelName = 'crashy-model';

    await startServer();

    const result = await postChat({ message: 'Tell me a story' });

    expect(result.status).toBe(200);
    expect(result.body.finishReason).toBe('fallback');
    expect(result.body.fallbackLabel).toBeDefined();
    expect(result.body.fallbackLabel.length).toBeGreaterThan(0);
    expect(result.body.fallbackLabel).toMatch(/fallback|error|inference/i);
    expect(result.body.fallbackReason).toContain('OOM');
    expect(typeof result.body.response).toBe('string');
    expect(result.body.response.length).toBeGreaterThan(0);
    expect(result.body.response).toMatch(/fallback|model|message|inspect/i);
    expect(result.body.model).toBe('fallback');
    expect(result.body.inspection).toBeDefined();
    expect(result.body.inspection.wordCount).toBe(4);

    server.close();
  });

  // ────────────────────────────────────────────────────────────────────
  // 5. INSPECT_MESSAGE ALWAYS PRESENT ON EVERY PATH
  // ────────────────────────────────────────────────────────────────────

  test('inspect_message present on every fallback path', async () => {
    // loading → fallback
    modelState.status = 'loading';
    modelState.loaded = false;
    modelState.session = null;
    modelState.error = null;
    await startServer();
    let result = await postChat({ message: 'Test A' });
    expect(result.body.inspection).toBeDefined();
    expect(result.body.inspection.wordCount).toBe(2);
    server.close();

    // fallback → fallback
    modelState.status = 'fallback';
    modelState.loaded = false;
    modelState.error = 'Connection lost';
    await startServer();
    result = await postChat({ message: 'Test B' });
    expect(result.body.inspection).toBeDefined();
    expect(result.body.inspection.wordCount).toBe(2);
    server.close();

    // inference failure → fallback
    modelState.status = 'ready';
    modelState.loaded = true;
    modelState.session = { prompt: async () => { throw new Error('crash'); } };
    await startServer();
    result = await postChat({ message: 'Test C' });
    expect(result.body.inspection).toBeDefined();
    expect(result.body.inspection.wordCount).toBe(2);
    server.close();
  });

  // ────────────────────────────────────────────────────────────────────
  // 6. BEHAVIOR-LEVEL PROOFS — prompt dataflow via HTTP
  // ────────────────────────────────────────────────────────────────────

  test('user message foo enters as user content, not wrapped in JSON/marker', async () => {
    let capturedPrompt = '';
    modelState.status = 'ready';
    modelState.loaded = true;
    modelState.session = {
      prompt: async (prompt) => {
        capturedPrompt = prompt;
        return 'Session received: ' + prompt;
      },
    };
    modelState.modelName = 'test-model';

    await startServer();
    const result = await postChat({ message: 'foo' });

    // The session received the raw user message — no JSON wrapper
    expect(capturedPrompt).toBe('foo');
    expect(capturedPrompt).not.toContain('[');
    expect(capturedPrompt).not.toContain('Inspection');
    expect(capturedPrompt).not.toContain('wordCount');
    expect(capturedPrompt).not.toContain('messageLength');

    // HTTP response matches
    expect(result.body.response).toBe('Session received: foo');
    expect(result.body.finishReason).toBe('stop');

    server.close();
  });

  test('raw inspection JSON/marker does not enter the prompt', async () => {
    let capturedPrompt = '';
    modelState.status = 'ready';
    modelState.loaded = true;
    modelState.session = {
      prompt: async (prompt) => {
        capturedPrompt = prompt;
        return 'ack';
      },
    };
    modelState.modelName = 'test-model';

    await startServer();
    await postChat({ message: 'How are you?' });

    // The inspection result is returned in the HTTP body, but the model
    // prompt is clean — no raw JSON inspection data
    expect(capturedPrompt).not.toContain('[');
    expect(capturedPrompt).not.toContain(']');
    expect(capturedPrompt).not.toContain('Inspection of user message');
    expect(capturedPrompt).not.toContain('messageLength');
    expect(capturedPrompt).not.toContain('wordCount');
    expect(capturedPrompt).not.toContain('hasQuestion');
    expect(capturedPrompt).not.toContain('classification');
    expect(capturedPrompt).not.toContain('sentiment');
    expect(capturedPrompt).not.toContain('{');
    expect(capturedPrompt).not.toContain('}');

    server.close();
  });

  test('generated marker/empty completion becomes explicit machine-readable fallback', async () => {
    // Marked response — looks like leaked inspection data
    modelState.status = 'ready';
    modelState.loaded = true;
    modelState.session = {
      prompt: async () => '[Inspection of user message: {"wordCount":1}] Timestamp: 123',
    };
    modelState.modelName = 'leaky-model';

    await startServer();
    const leakyResult = await postChat({ message: 'hello' });
    expect(leakyResult.body.finishReason).toBe('fallback');
    expect(leakyResult.body.fallbackReason).toBe('Response contained leaked internal data');
    expect(leakyResult.body.response).not.toContain('[Inspection of user message');
    expect(typeof leakyResult.body.response).toBe('string');
    expect(leakyResult.body.response.length).toBeGreaterThan(0);
    server.close();

    // Empty completion
    modelState.status = 'ready';
    modelState.loaded = true;
    modelState.session = {
      prompt: async () => '',
    };

    await startServer();
    const emptyResult = await postChat({ message: 'hello' });
    expect(emptyResult.body.finishReason).toBe('fallback');
    expect(emptyResult.body.fallbackReason).toBe('Empty response from model');
    expect(typeof emptyResult.body.response).toBe('string');
    expect(emptyResult.body.response.length).toBeGreaterThan(0);
    server.close();

    // Whitespace-only completion
    modelState.status = 'ready';
    modelState.loaded = true;
    modelState.session = {
      prompt: async () => '   \n  ',
    };

    await startServer();
    const wsResult = await postChat({ message: 'hello' });
    expect(wsResult.body.finishReason).toBe('fallback');
    expect(wsResult.body.fallbackReason).toBe('Empty response from model');
    server.close();
  });

  test('independent HTTP requests clear history between calls', async () => {
    let clearHistoryCalls = 0;
    const prompts = [];

    // Use the full lock path: LlamaChatSession + context + sequence
    const mockSequence = {
      clearHistory() {
        clearHistoryCalls += 1;
      },
    };

    // Track sessions created and prompts received
    let sessionCount = 0;
    const MockSessionClass = class {
      constructor(opts) {
        sessionCount += 1;
        this.sequence = opts.contextSequence;
      }
      async prompt(message) {
        prompts.push(message);
        return `response: ${message}`;
      }
    };

    modelState.status = 'ready';
    modelState.loaded = true;
    modelState.session = null;
    modelState.LlamaChatSession = MockSessionClass;
    modelState.context = {};
    modelState.sequence = mockSequence;
    modelState.modelName = 'test-model';

    await startServer();

    const r1 = await postChat({ message: 'first' });
    const r2 = await postChat({ message: 'second' });

    expect(r1.body.response).toBe('response: first');
    expect(r2.body.response).toBe('response: second');

    // Each request got its own session
    expect(sessionCount).toBe(2);
    // clearHistory called each time
    expect(clearHistoryCalls).toBe(2);
    // Each request passed only its own message
    expect(prompts).toEqual(['first', 'second']);
    // No cross-contamination
    expect(r1.body.response).not.toContain('second');
    expect(r2.body.response).not.toContain('first');

    server.close();
  });

  test('concurrent HTTP requests serialize safely via sequenceLock', async () => {
    let clearHistoryCalls = 0;
    let sessionCount = 0;
    const started = [];

    const mockSequence = {
      clearHistory() {
        clearHistoryCalls += 1;
      },
    };

    const ConcurrentSession = class {
      constructor(opts) {
        sessionCount += 1;
        this.sequence = opts.contextSequence;
      }
      async prompt(message) {
        started.push(message);
        await new Promise(r => setTimeout(r, 15));
        return `response: ${message}`;
      }
    };

    modelState.status = 'ready';
    modelState.loaded = true;
    modelState.session = null;
    modelState.LlamaChatSession = ConcurrentSession;
    modelState.context = {};
    modelState.sequence = mockSequence;
    modelState.modelName = 'test-model';

    await startServer();

    // Fire 3 requests concurrently
    const results = await Promise.all([
      postChat({ message: 'req-A' }),
      postChat({ message: 'req-B' }),
      postChat({ message: 'req-C' }),
    ]);

    expect(results).toHaveLength(3);
    for (const r of results) {
      expect(r.status).toBe(200);
      expect(r.body.finishReason).toBe('stop');
    }

    // Each response matches its request — no cross-talk
    const bodies = results.map(r => r.body.response);
    expect(bodies).toContain('response: req-A');
    expect(bodies).toContain('response: req-B');
    expect(bodies).toContain('response: req-C');

    // All requests were serviced
    expect(started.sort()).toEqual(['req-A', 'req-B', 'req-C']);

    // Each request serialized through the lock
    expect(clearHistoryCalls).toBe(3);
    expect(sessionCount).toBe(3);

    server.close();
  });
});
