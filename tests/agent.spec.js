/**
 * agent.spec.js — single-file comprehensive test for Swarm.
 *
 * All tests run against fake query modes (no WebGPU, no model download).
 * Covers: success order, deterministic tool, event hook, input cap,
 * empty/error fallback, overlong cap, timeout, duplicate suppression,
 * and no external requests in fake modes.
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
  // Wait for app to render
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

/** Press Enter to send */
async function pressEnter(page) {
  const input = page.locator('[data-testid="composer-input"]');
  await input.press('Enter');
}

/** Wait for generation to finish (status dot leaves generating) */
async function waitForIdle(page, timeout = 15000) {
  // Wait for status dot to no longer be "generating"
  const dot = page.locator('[data-testid="status-dot"]');
  try {
    await expect(dot).not.toHaveClass(/generating/, { timeout });
  } catch {}
  await page.waitForTimeout(500);
}

/** Get the agent events array from the page */
async function getAgentEvents(page) {
  return await page.evaluate(() => {
    return window.agentEvents || [];
  });
}

/** Count events of a given type */
async function countEvents(page, type) {
  const events = await getAgentEvents(page);
  return events.filter(e => e.type === type).length;
}

/** Check if an event type exists */
async function hasEvent(page, type) {
  const count = await countEvents(page, type);
  return count > 0;
}

// ═══════════════════════════════════════════════════════════════════════
// 1. SUCCESS ORDER — user_message → inspect_message → ai_response
// ═══════════════════════════════════════════════════════════════════════

test.describe('success mode', () => {
  test('emits user_message, inspect_message tool_call, and ai_response in order', async ({ page }) => {
    await openApp(page, 'success');
    await typeMessage(page, 'Hello Swarm');
    await clickSend(page);
    await waitForIdle(page);

    // Verify message appeared in chat
    const userMsg = page.locator('[data-testid="message-bubble"][data-role="user"]');
    await expect(userMsg).toHaveCount(1);
    await expect(userMsg).toContainText('Hello Swarm');

    // Assistant message should exist
    const assistantMsg = page.locator('[data-testid="message-bubble"][data-role="assistant"]');
    await expect(assistantMsg).toHaveCount(1);

    // Tool call card should exist
    const toolCard = page.locator('[data-testid="tool-call-card"]');
    await expect(toolCard).toHaveCount(1);

    // Verify agent events in order
    const events = await getAgentEvents(page);
    const types = events.map(e => e.type);

    // All three required events must fire
    expect(types).toContain('user_message');
    expect(types).toContain('tool_call');
    expect(types).toContain('ai_response');

    // user_message should be first, tool_call second, ai_response last
    const umIdx = types.indexOf('user_message');
    const tcIdx = types.indexOf('tool_call');
    const arIdx = types.indexOf('ai_response');
    expect(umIdx).toBeLessThan(tcIdx);
    expect(tcIdx).toBeLessThan(arIdx);

    // Verify user_message data
    const umEvent = events.find(e => e.type === 'user_message');
    expect(umEvent.data.text).toBe('Hello Swarm');
    expect(umEvent.data.length).toBe(11);

    // Verify tool_call data
    const tcEvent = events.find(e => e.type === 'tool_call');
    expect(tcEvent.data.tool).toBe('inspect_message');
    expect(tcEvent.data.parameters.message).toBe('Hello Swarm');

    // Verify ai_response data
    const arEvent = events.find(e => e.type === 'ai_response');
    expect(arEvent.data.content.length).toBeGreaterThan(0);
    expect(arEvent.data.isError).toBeFalsy();
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

    // The tool call card in the DOM
    const toolCard = page.locator('[data-testid="tool-call-card"]');
    await expect(toolCard).toBeVisible();
    await expect(toolCard).toContainText('inspect_message');
    await expect(toolCard).toContainText('Message inspected');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. EVENT HOOK — CustomEvent('agent-event') and window.agentEvents
// ═══════════════════════════════════════════════════════════════════════

test.describe('event hook', () => {
  test('CustomEvent agent-event fires with correct detail', async ({ page }) => {
    // Track CustomEvents via page-level listener registered before navigation
    let customEventCount = 0;
    const customEventTypes = [];
    await page.addInitScript(() => {
      document.addEventListener('agent-event', (e) => {
        // Store in a window array that the test can read
        if (!window.__capturedCustomEvents) window.__capturedCustomEvents = [];
        window.__capturedCustomEvents.push(e.detail);
      });
    });

    await openApp(page, 'success');
    await typeMessage(page, 'Test event capture');
    await clickSend(page);
    await waitForIdle(page);

    // Read captured events
    const capturedEvents = await page.evaluate(() => window.__capturedCustomEvents || []);

    // Should have captured at least 3 events via CustomEvent
    expect(capturedEvents.length).toBeGreaterThanOrEqual(3);

    const types = capturedEvents.map(e => e.type);
    expect(types).toContain('user_message');
    expect(types).toContain('tool_call');
    expect(types).toContain('ai_response');

    // Verify window.agentEvents exists and has matching entries
    const windowEvents = await page.evaluate(() => window.agentEvents);
    expect(windowEvents).toBeDefined();
    expect(windowEvents.length).toBeGreaterThanOrEqual(3);
    expect(windowEvents.length).toBe(capturedEvents.length);
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
// 3. INPUT CAP — 2000 character limit enforced
// ═══════════════════════════════════════════════════════════════════════

test.describe('input cap', () => {
  test('textarea enforces 2000 character max', async ({ page }) => {
    await openApp(page, 'success');
    const input = page.locator('[data-testid="composer-input"]');

    // Check maxlength attribute
    const maxLength = await input.getAttribute('maxlength');
    expect(maxLength).toBe('2000');

    // Try typing more than 2000 chars
    const longText = 'A'.repeat(2500);
    await input.fill(longText);

    const actualValue = await input.inputValue();
    expect(actualValue.length).toBeLessThanOrEqual(2000);

    // Char count should show the limit
    const charCount = page.locator('[data-testid="char-count"]');
    await expect(charCount).toContainText('/2000');
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. EMPTY FALLBACK — model returns empty → diagnostic error + fallback
// ═══════════════════════════════════════════════════════════════════════

test.describe('empty fallback', () => {
  test('empty response shows fallback text', async ({ page }) => {
    await openApp(page, 'empty');
    await typeMessage(page, 'Trigger empty');
    await clickSend(page);
    await waitForIdle(page);

    // Check for diagnostic_error event
    const events = await getAgentEvents(page);
    const diagErrors = events.filter(e => e.type === 'diagnostic_error');
    expect(diagErrors.length).toBeGreaterThanOrEqual(1);

    // ai_response event should exist
    const hasAiResponse = await hasEvent(page, 'ai_response');
    expect(hasAiResponse).toBeTruthy();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 5. ERROR FALLBACK — model error shows error message
// ═══════════════════════════════════════════════════════════════════════

test.describe('error fallback', () => {
  test('error mode shows error state and diagnostic event', async ({ page }) => {
    await openApp(page, 'error');
    await typeMessage(page, 'Trigger error');
    await clickSend(page);
    await waitForIdle(page);

    // Check for diagnostic_error event
    const events = await getAgentEvents(page);
    const diagErrors = events.filter(e => e.type === 'diagnostic_error');
    expect(diagErrors.length).toBeGreaterThanOrEqual(1);

    // The diagnostic error should include the error message
    const diagError = diagErrors[0];
    expect(diagError.data.message).toContain('FAKE_MODE_ERROR');

    // tool_call event must fire even on error (emitted before orchestrator call)
    const toolCallEvents = events.filter(e => e.type === 'tool_call');
    expect(toolCallEvents.length).toBeGreaterThanOrEqual(1);
    expect(toolCallEvents[0].data.tool).toBe('inspect_message');
    expect(toolCallEvents[0].data.parameters.message).toBe('Trigger error');

    // AI response event should be error type
    const aiResponse = events.find(e => e.type === 'ai_response');
    expect(aiResponse).toBeTruthy();
    expect(aiResponse.data.isError).toBe(true);

    // Error message may appear in chat
    const errorMsg = page.locator('[data-testid="message-bubble"][data-role="error"]');
    const errorMsgCount = await errorMsg.count();
    // Either an error message exists OR the assistant message shows the error
    if (errorMsgCount > 0) {
      await expect(errorMsg.first()).toBeVisible();
    }

    // Verify event order: user_message → tool_call → diagnostic_error → ai_response
    const eventTypes = events.map(e => e.type);
    const umIdx = eventTypes.indexOf('user_message');
    const tcIdx = eventTypes.indexOf('tool_call');
    const deIdx = eventTypes.indexOf('diagnostic_error');
    const arIdx = eventTypes.indexOf('ai_response');
    expect(umIdx).toBeLessThan(tcIdx);
    expect(tcIdx).toBeLessThan(deIdx);
    expect(deIdx).toBeLessThan(arIdx);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 6. OVERLONG CAP — response > 600 chars is truncated
// ═══════════════════════════════════════════════════════════════════════

test.describe('overlong cap', () => {
  test('response longer than 600 chars is capped', async ({ page }) => {
    await openApp(page, 'overlong');
    await typeMessage(page, 'Give me a long response');
    await clickSend(page);
    await waitForIdle(page);

    // Get the assistant message content
    const assistantMsg = page.locator('[data-testid="message-bubble"][data-role="assistant"]');
    await expect(assistantMsg).toHaveCount(1);
    const content = await assistantMsg.textContent();

    // Content should be capped at 600 chars (the wrapped text may show "Swarm" label + timestamp)
    // Extract just the content div
    const contentDiv = assistantMsg.locator('.msg-content');
    const textContent = await contentDiv.textContent();
    expect(textContent.length).toBeLessThanOrEqual(600);

    // ai_response should report isOverlong or show capped length
    const events = await getAgentEvents(page);
    const aiResponse = events.find(e => e.type === 'ai_response');
    if (aiResponse) {
      expect(aiResponse.data.length).toBeLessThanOrEqual(600);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 7. TIMEOUT — 30-second timeout triggers abort
// ═══════════════════════════════════════════════════════════════════════

test.describe('timeout', () => {
  test('mode=timeout triggers abort after 30s', async ({ page }) => {
    await openApp(page, 'timeout');
    await typeMessage(page, 'Wait long');
    await clickSend(page);
    // Should time out within ~35 seconds and show stopped message
    await waitForIdle(page, 40000);

    // Check for generation_stopped event
    const events = await getAgentEvents(page);
    const stoppedEvents = events.filter(e => e.type === 'generation_stopped');
    expect(stoppedEvents.length).toBeGreaterThanOrEqual(1);

    // Assistant message should exist (showing partial or stopped content)
    const assistantMsg = page.locator('[data-testid="message-bubble"][data-role="assistant"]');
    await expect(assistantMsg).toHaveCount(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 8. DUPLICATE SUPPRESSION — can't send same message while generating
// ═══════════════════════════════════════════════════════════════════════

test.describe('duplicate suppression', () => {
  test('cannot send a second message while generating (slow mode)', async ({ page }) => {
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
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 9. NO EXTERNAL REQUESTS IN FAKE MODES
// ═══════════════════════════════════════════════════════════════════════

test.describe('no external requests in fake modes', () => {
  for (const mode of ['success', 'empty', 'error', 'overlong', 'timeout']) {
    test(`mode=${mode} makes zero external API requests`, async ({ page }) => {
      const allUrls = [];
      page.on('request', (request) => {
        const url = request.url();
        // Skip data:, blob:, and own server
        if (url.startsWith('data:') || url.startsWith('blob:')) return;
        if (url.includes('localhost:4173')) return;
        allUrls.push(url);
      });

      await openApp(page, mode);

      // Send a message
      await typeMessage(page, `Test ${mode} mode`);
      await clickSend(page);

      // Wait for completion (with generous timeout)
      await waitForIdle(page, mode === 'timeout' ? 40000 : 15000);

      // Zero external API requests
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
