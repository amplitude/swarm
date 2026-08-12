/**
 * agent.spec.js — single-file comprehensive test for Swarm.
 *
 * All tests run against fake query modes (no WebGPU, no model download).
 * Covers: success order, deterministic tool, event hook, input cap,
 * empty/error/timeout fallback, overlong cap, max_tokens verification,
 * one tool per request, cap enforcement, late arrival, duplicate suppression,
 * and no external requests in fake modes.
 *
 * Key contract:
 *   Success: [user_message, tool_call, ai_response] — exactly 1 each
 *   Failure: [user_message, tool_call, error, ai_response] — exactly 1 each
 *   Event types: user_message, tool_call, ai_response, error
 *   Error codes: GENERATION_FAILED, GENERATION_TIMEOUT, EMPTY_RESPONSE, ABORTED
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

/** Open the app in a given mode (fake query mode or no param for real) */
async function openApp(page, mode) {
  await page.goto(mode ? `/?mode=${mode}` : '/');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="status-bar"]', { timeout: 5000 });
  await page.waitForSelector('[data-testid="composer-input"]', { timeout: 5000 });
}

/** Type text into the composer (clears existing) */
async function typeMessage(page, text) {
  const input = page.locator('[data-testid="composer-input"]');
  await expect(input).toBeVisible({ timeout: 3000 });
  await input.fill(text);
  await page.waitForTimeout(100);
}

/** Click the Send button */
async function clickSend(page) {
  const sendBtn = page.locator('[data-testid="send-btn"]');
  await expect(sendBtn).toBeVisible({ timeout: 3000 });
  await expect(sendBtn).not.toBeDisabled({ timeout: 3000 });
  await sendBtn.click();
}

/** Wait for generation to finish (status dot leaves generating) */
async function waitForIdle(page, timeout = 15000) {
  const dot = page.locator('[data-testid="status-dot"]');
  try {
    await expect(dot).not.toHaveClass(/generating/, { timeout });
  } catch {/* ignore timeout race */}
  await page.waitForTimeout(500);
}

/** Get the agent events array from the page */
async function getAgentEvents(page) {
  return await page.evaluate(() => window.agentEvents || []);
}

/** Group events by requestId using timestamps and types */
function groupByRequest(events) {
  // Each request starts with user_message and ends with ai_response.
  // This heuristic groups by iterating and splitting on user_message boundaries.
  const requests = [];
  let current = [];
  for (const e of events) {
    if (e.type === 'user_message' && current.length > 0) {
      requests.push(current);
      current = [];
    }
    current.push(e);
  }
  if (current.length > 0) requests.push(current);
  return requests;
}

/** Assert exact order for a single request's events */
function assertOrder(events, expectedTypes, label) {
  const types = events.map(e => e.type);
  expect(types, `${label}: expected ${JSON.stringify(expectedTypes)}, got ${JSON.stringify(types)}`)
    .toEqual(expectedTypes);
}

/** Assert exact count of each event type in a single request */
function assertCounts(events, counts, label) {
  for (const [type, expected] of Object.entries(counts)) {
    const actual = events.filter(e => e.type === type).length;
    expect(actual, `${label}: expected ${expected} x ${type}, got ${actual}`)
      .toBe(expected);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// 1. SUCCESS ORDER — exactly [user_message, tool_call, ai_response]
// ═══════════════════════════════════════════════════════════════════════

test.describe('success mode', () => {
  test('emits exactly user_message, tool_call, ai_response in that order', async ({ page }) => {
    await openApp(page, 'success');
    await typeMessage(page, 'Hello Swarm');
    await clickSend(page);
    await waitForIdle(page);

    // Verify UI
    const userMsg = page.locator('[data-testid="message-bubble"][data-role="user"]');
    await expect(userMsg).toHaveCount(1);
    await expect(userMsg).toContainText('Hello Swarm');

    const assistantMsg = page.locator('[data-testid="message-bubble"][data-role="assistant"]');
    await expect(assistantMsg).toHaveCount(1);

    const toolCard = page.locator('[data-testid="tool-call-card"]');
    await expect(toolCard).toHaveCount(1);

    // Verify agent events — only the 3 required types exist
    const events = await getAgentEvents(page);
    const types = events.map(e => e.type);
    expect(types).toEqual(['user_message', 'tool_call', 'ai_response']);

    // Verify data fields
    const umEvent = events.find(e => e.type === 'user_message');
    expect(umEvent.data.text).toBe('Hello Swarm');
    expect(umEvent.data.length).toBe(11);

    const tcEvent = events.find(e => e.type === 'tool_call');
    expect(tcEvent.data.tool).toBe('inspect_message');
    expect(tcEvent.data.parameters.message).toBe('Hello Swarm');

    const arEvent = events.find(e => e.type === 'ai_response');
    expect(arEvent.data.content.length).toBeGreaterThan(0);
    expect(arEvent.data.isError).toBeFalsy();
    expect(arEvent.data.isOverlong).toBe(false);

    // Grouped assertions: one request, exactly 3 events, exact order
    const requests = groupByRequest(events);
    expect(requests).toHaveLength(1);
    assertOrder(requests[0], ['user_message', 'tool_call', 'ai_response'], 'success request');
    assertCounts(requests[0], { user_message: 1, tool_call: 1, ai_response: 1 }, 'success counts');
  });

  test('deterministic inspect_message tool returns expected structure', async ({ page }) => {
    await openApp(page, 'success');
    await typeMessage(page, 'How are you?');
    await clickSend(page);
    await waitForIdle(page);

    const events = await getAgentEvents(page);
    const tcEvent = events.find(e => e.type === 'tool_call' && e.data.tool === 'inspect_message');
    expect(tcEvent).toBeTruthy();
    expect(tcEvent.data.parameters).toBeDefined();
    expect(tcEvent.data.parameters.message).toBe('How are you?');
    expect(tcEvent.data.tool).toBe('inspect_message');
    expect(tcEvent.data.timestamp).toBeGreaterThan(0);

    const toolCard = page.locator('[data-testid="tool-call-card"]');
    await expect(toolCard).toBeVisible();
    await expect(toolCard).toContainText('inspect_message');
    await expect(toolCard).toContainText('Message inspected');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. EVENT HOOK — CustomEvent('agent-event') and window.agentEvents
//    Each observes exactly one event per occurrence (no duplicates)
// ═══════════════════════════════════════════════════════════════════════

test.describe('event hook', () => {
  test('CustomEvent and window.agentEvents each observe exactly one event per occurrence', async ({ page }) => {
    // Register listener before navigation
    await page.addInitScript(() => {
      if (!window.__capturedCustomEvents) window.__capturedCustomEvents = [];
      document.addEventListener('agent-event', (e) => {
        window.__capturedCustomEvents.push(e.detail);
      });
    });

    await openApp(page, 'success');
    await typeMessage(page, 'Test event capture');
    await clickSend(page);
    await waitForIdle(page);

    const capturedEvents = await page.evaluate(() => window.__capturedCustomEvents || []);
    const windowEvents = await page.evaluate(() => window.agentEvents);

    // Both arrays must exist
    expect(capturedEvents).toBeDefined();
    expect(windowEvents).toBeDefined();

    // Both must have the same length and content
    expect(capturedEvents.length).toBe(windowEvents.length);
    expect(capturedEvents.length).toBe(3); // exactly 3: user_message, tool_call, ai_response

    // Verify types match
    const capturedTypes = capturedEvents.map(e => e.type);
    const windowTypes = windowEvents.map(e => e.type);
    expect(capturedTypes).toEqual(windowTypes);
    expect(capturedTypes).toEqual(['user_message', 'tool_call', 'ai_response']);

    // Each event has timestamp and data
    for (const event of capturedEvents) {
      expect(typeof event.type).toBe('string');
      expect(typeof event.timestamp).toBe('number');
      expect(typeof event.data).toBe('object');
    }
  });

  test('each event has timestamp and data fields', async ({ page }) => {
    await openApp(page, 'success');
    await typeMessage(page, 'Check fields');
    await clickSend(page);
    await waitForIdle(page);

    const events = await getAgentEvents(page);
    for (const event of events) {
      expect(event.type).toBeDefined();
      expect(typeof event.type).toBe('string');
      expect(event.timestamp).toBeDefined();
      expect(typeof event.timestamp).toBe('number');
      expect(event.data).toBeDefined();
      expect(typeof event.data).toBe('object');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. INPUT/COLLECTION/FINAL CAPS — 2000 / 1000 / 600
// ═══════════════════════════════════════════════════════════════════════

test.describe('caps enforcement', () => {
  test('input textarea enforces 2000 character max', async ({ page }) => {
    await openApp(page, 'success');
    const input = page.locator('[data-testid="composer-input"]');

    const maxLength = await input.getAttribute('maxlength');
    expect(maxLength).toBe('2000');

    const longText = 'A'.repeat(2500);
    await input.fill(longText);

    const actualValue = await input.inputValue();
    expect(actualValue.length).toBeLessThanOrEqual(2000);

    const charCount = page.locator('[data-testid="char-count"]');
    await expect(charCount).toContainText('/2000');
  });

  test('response longer than 600 chars is capped at 600', async ({ page }) => {
    await openApp(page, 'overlong');
    await typeMessage(page, 'Give me a long response');
    await clickSend(page);
    await waitForIdle(page);

    const assistantMsg = page.locator('[data-testid="message-bubble"][data-role="assistant"]');
    await expect(assistantMsg).toHaveCount(1);

    const contentDiv = assistantMsg.locator('.msg-content');
    const textContent = await contentDiv.textContent();
    expect(textContent.length).toBeLessThanOrEqual(600);

    const events = await getAgentEvents(page);
    const arEvent = events.find(e => e.type === 'ai_response');
    expect(arEvent).toBeTruthy();
    expect(arEvent.data.length).toBeLessThanOrEqual(600);
    expect(arEvent.data.isOverlong).toBe(true);
  });

  test('streamed content is collected with 1000 char cap — collectedCharacters, collectionTruncated, final 600, event count', async ({ page }) => {
    await openApp(page, 'overlong');
    await typeMessage(page, 'Test collection cap');
    await clickSend(page);
    await waitForIdle(page, 15000);

    // ── 1. Event order and count (exact success contract) ──
    const events = await getAgentEvents(page);
    const types = events.map(e => e.type);
    expect(types).toEqual(['user_message', 'tool_call', 'ai_response']);

    const toolCalls = events.filter(e => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].data.tool).toBe('inspect_message');

    const arEvents = events.filter(e => e.type === 'ai_response');
    expect(arEvents).toHaveLength(1);

    const arEvent = arEvents[0];

    // ── 2. Stream collection cap: exactly 1000 chars collected ──
    expect(arEvent.data.collectedCharacters).toBe(1000);
    expect(arEvent.data.collectionTruncated).toBe(true);

    // ── 3. Final display cap: 600 chars ──
    expect(arEvent.data.length).toBe(600);
    expect(arEvent.data.content.length).toBe(600);
    expect(arEvent.data.isOverlong).toBe(true);

    // ── 4. DOM content also capped at 600 ──
    const assistantMsg = page.locator('[data-testid="message-bubble"][data-role="assistant"]');
    await expect(assistantMsg).toHaveCount(1);
    const contentDiv = assistantMsg.locator('.msg-content');
    const textContent = await contentDiv.textContent();
    expect(textContent.length).toBe(600);

    // ── 5. After waiting for any late chunks, no extra events appear ──
    await page.waitForTimeout(2000);
    const eventsAfter = await getAgentEvents(page);
    expect(eventsAfter.length).toBe(events.length);
    expect(eventsAfter.filter(e => e.type === 'ai_response')).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. EMPTY FALLBACK — [user_message, tool_call, error(EMPTY_RESPONSE), ai_response]
// ═══════════════════════════════════════════════════════════════════════

test.describe('empty fallback', () => {
  test('empty mode: order is [user_message, tool_call, error, ai_response] with EMPTY_RESPONSE code', async ({ page }) => {
    await openApp(page, 'empty');
    await typeMessage(page, 'Trigger empty');
    await clickSend(page);
    await waitForIdle(page);

    const events = await getAgentEvents(page);
    const requests = groupByRequest(events);
    expect(requests).toHaveLength(1);

    // Exact order
    assertOrder(requests[0],
      ['user_message', 'tool_call', 'error', 'ai_response'],
      'empty request order');

    // Exact counts
    assertCounts(requests[0], { user_message: 1, tool_call: 1, error: 1, ai_response: 1 }, 'empty request counts');

    // Verify error code
    const errEvent = events.find(e => e.type === 'error');
    expect(errEvent.data.code).toBe('EMPTY_RESPONSE');
    expect(errEvent.data.message).toContain('empty');

    // ai_response should exist
    const arEvent = events.find(e => e.type === 'ai_response');
    expect(arEvent).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. ERROR FALLBACK — [user_message, tool_call, error(GENERATION_FAILED), ai_response]
// ═══════════════════════════════════════════════════════════════════════

test.describe('error fallback', () => {
  test('error mode: order is [user_message, tool_call, error, ai_response] with GENERATION_FAILED code', async ({ page }) => {
    await openApp(page, 'error');
    await typeMessage(page, 'Trigger error');
    await clickSend(page);
    await waitForIdle(page);

    const events = await getAgentEvents(page);
    const requests = groupByRequest(events);
    expect(requests).toHaveLength(1);

    // Exact order
    assertOrder(requests[0],
      ['user_message', 'tool_call', 'error', 'ai_response'],
      'error request order');

    // Exact counts
    assertCounts(requests[0], { user_message: 1, tool_call: 1, error: 1, ai_response: 1 }, 'error request counts');

    // Verify error code
    const errEvent = events.find(e => e.type === 'error');
    expect(errEvent.data.code).toBe('GENERATION_FAILED');
    expect(errEvent.data.message).toContain('FAKE_MODE_ERROR');

    // AI response should be error type
    const arEvent = events.find(e => e.type === 'ai_response');
    expect(arEvent).toBeTruthy();
    expect(arEvent.data.isError).toBe(true);

    // tool_call fires even on error
    const tcEvent = events.find(e => e.type === 'tool_call');
    expect(tcEvent.data.tool).toBe('inspect_message');

    // Error message may appear in chat
    const errorMsg = page.locator('[data-testid="message-bubble"][data-role="error"]');
    const errorMsgCount = await errorMsg.count();
    if (errorMsgCount > 0) {
      await expect(errorMsg.first()).toBeVisible();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. TIMEOUT — [user_message, tool_call, error(GENERATION_TIMEOUT), ai_response]
//    Also tests late arrival: after timeout, late content does not add events
// ═══════════════════════════════════════════════════════════════════════

test.describe('timeout', () => {
  test('timeout mode: order is [user_message, tool_call, error, ai_response] with GENERATION_TIMEOUT code', async ({ page }) => {
    await openApp(page, 'timeout');
    await typeMessage(page, 'Wait long');
    await clickSend(page);
    // Should time out within ~35 seconds
    await waitForIdle(page, 40000);

    const events = await getAgentEvents(page);
    const requests = groupByRequest(events);
    expect(requests).toHaveLength(1);

    // Exact order
    assertOrder(requests[0],
      ['user_message', 'tool_call', 'error', 'ai_response'],
      'timeout request order');

    // Exact counts
    assertCounts(requests[0], { user_message: 1, tool_call: 1, error: 1, ai_response: 1 }, 'timeout request counts');

    // Verify error code
    const errEvent = events.find(e => e.type === 'error');
    expect(errEvent.data.code).toBe('GENERATION_TIMEOUT');
    expect(errEvent.data.message).toContain('timed out');

    // AI response should be present and marked isError
    const arEvent = events.find(e => e.type === 'ai_response');
    expect(arEvent).toBeTruthy();
    expect(arEvent.data.isError).toBe(true);

    // Assistant message should exist (showing stopped content)
    const assistantMsg = page.locator('[data-testid="message-bubble"][data-role="assistant"]');
    await expect(assistantMsg).toHaveCount(1);
  });

  test('timeout late arrival: same request still has exactly one ai_response, no changed content/events', async ({ page }) => {
    // The timeout fake mode intentionally produces content ~5s after the 30s
    // timeout fires. Verify that this late content does not produce extra
    // events or change the existing ai_response.
    await openApp(page, 'timeout');
    await typeMessage(page, 'Late test');
    await clickSend(page);
    await waitForIdle(page, 40000);

    // Capture first snapshot after idle
    const events1 = await getAgentEvents(page);
    const ar1 = events1.find(e => e.type === 'ai_response');
    const content1 = ar1 ? ar1.data.content : null;

    // Wait additional time to allow late content to arrive and be processed
    await page.waitForTimeout(5000);

    // Capture second snapshot
    const events2 = await getAgentEvents(page);
    const ar2 = events2.find(e => e.type === 'ai_response');

    // Same number of events
    expect(events2.length).toBe(events1.length);

    // Still exactly one ai_response
    const arCount2 = events2.filter(e => e.type === 'ai_response').length;
    expect(arCount2).toBe(1);

    // Content unchanged (no late arrival spliced in)
    if (ar2 && ar1) {
      expect(ar2.data.content).toBe(content1);
      expect(ar2.data.length).toBe(ar1.data.length);
    }

    // No extra events appeared
    const errorCount2 = events2.filter(e => e.type === 'error').length;
    expect(errorCount2).toBe(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. MAX_TOKENS:128 — request snapshot from fake mode
// ═══════════════════════════════════════════════════════════════════════

test.describe('max_tokens verification', () => {
  test('model request receives max_tokens:128', async ({ page }) => {
    await openApp(page, 'success');
    await typeMessage(page, 'Token test');
    await clickSend(page);
    await waitForIdle(page);

    // window._lastProviderRequest is set by FakeProvider.generate()
    const lastRequest = await page.evaluate(() => window._lastProviderRequest);
    expect(lastRequest).toBeTruthy();
    expect(lastRequest.max_tokens).toBe(128);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. ONE TOOL PER REQUEST
// ═══════════════════════════════════════════════════════════════════════

test.describe('one tool per request', () => {
  test('only one tool (inspect_message) executes per request', async ({ page }) => {
    await openApp(page, 'success');
    await typeMessage(page, 'One tool only');
    await clickSend(page);
    await waitForIdle(page);

    const events = await getAgentEvents(page);
    const toolCalls = events.filter(e => e.type === 'tool_call');
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0].data.tool).toBe('inspect_message');

    // Verify through request snapshot too
    const lastRequest = await page.evaluate(() => window._lastProviderRequest);
    if (lastRequest && lastRequest.tools) {
      expect(lastRequest.tools).toHaveLength(1);
      expect(lastRequest.tools[0].function.name).toBe('inspect_message');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 9. FAILURE MODE ORDER — parameterised assertion for all failure modes
// ═══════════════════════════════════════════════════════════════════════

test.describe('failure mode order (parameterised)', () => {
  const failureModes = [
    { mode: 'empty',     expectedTypes: ['user_message', 'tool_call', 'error', 'ai_response'], check: (e) => expect(e.data.code).toBe('EMPTY_RESPONSE') },
    { mode: 'error',     expectedTypes: ['user_message', 'tool_call', 'error', 'ai_response'], check: (e) => expect(e.data.code).toBe('GENERATION_FAILED') },
    { mode: 'timeout',   expectedTypes: ['user_message', 'tool_call', 'error', 'ai_response'], check: (e) => expect(e.data.code).toBe('GENERATION_TIMEOUT') },
  ];

  for (const { mode, expectedTypes, check } of failureModes) {
    test(`mode=${mode}: order and counts match`, async ({ page }) => {
      await openApp(page, mode);
      await typeMessage(page, `Test ${mode} mode`);
      await clickSend(page);
      await waitForIdle(page, mode === 'timeout' ? 40000 : 15000);

      const events = await getAgentEvents(page);
      const requests = groupByRequest(events);
      expect(requests).toHaveLength(1);

      const thisRequest = requests[0];
      const types = thisRequest.map(e => e.type);

      // Exact order
      expect(types).toEqual(expectedTypes);

      // Exact counts — exactly 1 of each
      const counts = {};
      for (const t of types) counts[t] = (counts[t] || 0) + 1;
      for (const t of expectedTypes) {
        expect(counts[t], `mode=${mode}: expected exactly 1 x ${t}`).toBe(1);
      }

      // Assert error code on the error event
      const errEvent = thisRequest.find(e => e.type === 'error');
      if (errEvent) check(errEvent);
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════
// 10. DUPLICATE SUPPRESSION — can't send same message while generating
// ═══════════════════════════════════════════════════════════════════════

test.describe('duplicate suppression', () => {
  test('cannot send a second message while generating (success mode)', async ({ page }) => {
    await openApp(page, 'success');
    const input = page.locator('[data-testid="composer-input"]');
    const sendBtn = page.locator('[data-testid="send-btn"]');

    // Send first message
    await typeMessage(page, 'First message');
    await clickSend(page);

    // Immediately after sending, the send button should be disabled
    await expect(sendBtn).toBeDisabled({ timeout: 2000 });

    // Try to type and send a second message (should be blocked)
    await input.fill('Second message');
    await expect(sendBtn).toBeDisabled();

    // Wait for generation to complete
    await waitForIdle(page);

    // Now send button should be enabled again
    await expect(sendBtn).not.toBeDisabled({ timeout: 3000 });

    // Verify only one user message and one assistant message exist
    const userMsgs = page.locator('[data-testid="message-bubble"][data-role="user"]');
    await expect(userMsgs).toHaveCount(1);

    // Verify only one request's worth of events
    const events = await getAgentEvents(page);
    const requests = groupByRequest(events);
    expect(requests).toHaveLength(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 11. NO EXTERNAL REQUESTS IN FAKE MODES
// ═══════════════════════════════════════════════════════════════════════

test.describe('no external requests in fake modes', () => {
  for (const mode of ['success', 'empty', 'error', 'overlong', 'timeout']) {
    test(`mode=${mode} makes zero external API requests`, async ({ page }) => {
      const allUrls = [];
      page.on('request', (request) => {
        const url = request.url();
        if (url.startsWith('data:') || url.startsWith('blob:')) return;
        if (url.includes('localhost:4173')) return;
        allUrls.push(url);
      });

      await openApp(page, mode);
      await typeMessage(page, `Test ${mode} mode`);
      await clickSend(page);
      await waitForIdle(page, mode === 'timeout' ? 40000 : 15000);

      const forbiddenPatterns = [
        /api\.openai\.com/,
        /api\.anthropic\.com/,
        /generativelanguage\.googleapis\.com/,
        /api\.together\.xyz/,
        /api\.groq\.com/,
        /localhost:11434/,
        /127\.0\.0\.1:11434/,
      ];

      const violations = allUrls.filter(url =>
        forbiddenPatterns.some(p => p.test(url))
      );

      if (violations.length > 0) {
        console.log(`Forbidden requests in mode=${mode}:`, violations);
      }
      expect(violations).toHaveLength(0);
      console.log(`mode=${mode}: ${allUrls.length} non-server URLs, 0 violations`);
    });
  }
});
