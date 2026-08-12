/**
 * agent.spec.js — Swarm local-agent tests.
 *
 * Two test domains:
 *   1. API tests — POST /api/chat directly (fast, no browser)
 *   2. UI tests — browser renders correctly for each mode
 *
 * Fake modes (no model, no download):
 *   success / empty / error / timeout
 *
 * Key contract for POST /api/chat:
 *   { response, finishReason, inspection, model }
 *   - model: "fake" | "fallback" | "tinyllama-1.1b"
 *   - finishReason: "stop" | "fallback"
 *   - inspection always present with messageLength, wordCount, etc.
 */

import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ═══════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════

/** Call POST /api/chat directly via fetch */
async function apiChat(requestContext, message, mode) {
  const body = { message, userId: 'test', sessionId: 'test-session' };
  if (mode) body.mode = mode;

  const res = await requestContext.post('/api/chat', { data: body });
  expect(res.ok()).toBe(true);
  return await res.json();
}

/** Open the app in a given mode via URL query param */
async function openApp(page, mode) {
  await page.goto(mode ? `/?mode=${mode}` : '/');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="status-bar"]', { timeout: 5000 });
  await page.waitForSelector('[data-testid="composer-input"]', { timeout: 5000 });
}

/** Type text into the composer */
async function typeMessage(page, text) {
  const input = page.locator('[data-testid="composer-input"]');
  await expect(input).toBeVisible({ timeout: 3000 });
  await input.fill(text);
  await page.waitForTimeout(100);
}

/** Click the Send button and wait for response */
async function sendAndWait(page, timeout = 15000) {
  const sendBtn = page.locator('[data-testid="send-btn"]');
  await expect(sendBtn).toBeVisible({ timeout: 3000 });
  await expect(sendBtn).not.toBeDisabled({ timeout: 3000 });
  await sendBtn.click();
  // Wait for assistant message to appear
  await page.waitForSelector('[data-testid="message-bubble"][data-role="assistant"]', { timeout });
  await page.waitForTimeout(500);
}

// ═══════════════════════════════════════════════════════════════════════
// 1. API TESTS — POST /api/chat directly
// ═══════════════════════════════════════════════════════════════════════

test.describe('POST /api/chat', () => {
  test('success mode returns expected response structure', async ({ request }) => {
    const result = await apiChat(request, 'Hello Swarm', 'success');

    expect(result).toBeDefined();
    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(0);
    expect(result.finishReason).toBe('stop');
    expect(result.model).toBe('fake');

    // Inspection must be present
    expect(result.inspection).toBeDefined();
    expect(result.inspection.messageLength).toBe(11);
    expect(result.inspection.wordCount).toBe(2);
    expect(result.inspection.hasQuestion).toBe(false);
    expect(result.inspection.classification).toBe('medium');
    expect(result.inspection.sentiment).toBe('neutral');
  });

  test('empty mode returns empty string response', async ({ request }) => {
    const result = await apiChat(request, 'Trigger empty', 'empty');

    expect(result).toBeDefined();
    expect(result.response).toBe('');
    expect(result.finishReason).toBe('stop');
    expect(result.model).toBe('fake');

    // Inspection still present
    expect(result.inspection).toBeDefined();
    expect(result.inspection.messageLength).toBe(13);
  });

  test('error mode returns fallback response despite error', async ({ request }) => {
    const result = await apiChat(request, 'Trigger error', 'error');

    expect(result).toBeDefined();
    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(0);
    // Error mode's exception is caught and returns fallback
    expect(result.finishReason).toBe('fallback');
    expect(result.model).toBe('fake');
    expect(result.fallbackReason).toContain('FAKE_MODE_ERROR');
    expect(result.inspection).toBeDefined();
  });

  test('overlong mode returns long content', async ({ request }) => {
    const result = await apiChat(request, 'Long response', 'overlong');

    expect(result).toBeDefined();
    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(600);
    expect(result.finishReason).toBe('stop');
    expect(result.model).toBe('fake');
    expect(result.inspection).toBeDefined();
  });

  test('inspect_message always returns deterministic structure', async ({ request }) => {
    const result = await apiChat(request, 'How are you?', 'success');

    expect(result.inspection).toBeDefined();
    expect(result.inspection.messageLength).toBe(12);
    expect(result.inspection.wordCount).toBe(3);
    expect(result.inspection.hasQuestion).toBe(true);
    expect(result.inspection.hasExclamation).toBe(false);
    expect(result.inspection.hasCode).toBe(false);
    expect(result.inspection.isOverlong).toBe(false);
    expect(typeof result.inspection.classification).toBe('string');
    expect(typeof result.inspection.sentiment).toBe('string');
    expect(typeof result.inspection.timestamp).toBe('number');
  });

  test('empty message returns 400 error', async ({ request }) => {
    const res = await request.post('/api/chat', {
      data: { message: '', userId: 'test', sessionId: 'test' },
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('message');
  });

  test('no message field returns 400 error', async ({ request }) => {
    const res = await request.post('/api/chat', {
      data: { userId: 'test', sessionId: 'test' },
    });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBe(400);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 2. UI TESTS — browser renders correctly
// ═══════════════════════════════════════════════════════════════════════

test.describe('UI rendering', () => {
  test('success mode: user and assistant messages appear', async ({ page }) => {
    await openApp(page, 'success');
    await typeMessage(page, 'Hello Swarm');
    await sendAndWait(page);

    // User message
    const userMsg = page.locator('[data-testid="message-bubble"][data-role="user"]');
    await expect(userMsg).toHaveCount(1);
    await expect(userMsg).toContainText('Hello Swarm');

    // Assistant message
    const assistantMsg = page.locator('[data-testid="message-bubble"][data-role="assistant"]');
    await expect(assistantMsg).toHaveCount(1);
    await expect(assistantMsg).toContainText('fake success response');
  });

  test('empty mode: assistant bubble shows [No response]', async ({ page }) => {
    await openApp(page, 'empty');
    await typeMessage(page, 'Test empty');
    await sendAndWait(page);

    const assistantMsg = page.locator('[data-testid="message-bubble"][data-role="assistant"]');
    await expect(assistantMsg).toHaveCount(1);

    const contentDiv = assistantMsg.locator('.msg-content');
    const textContent = await contentDiv.textContent();
    // Should show the empty response label
    expect(textContent).toBe('[No response]');
  });

  test('error mode: fallback response is visible', async ({ page }) => {
    await openApp(page, 'error');
    await typeMessage(page, 'Trigger error');
    await sendAndWait(page);

    // The error fake mode throws, but the server catches it and returns a
    // fallback response with finishReason 'fallback'
    const assistantMsg = page.locator('[data-testid="message-bubble"][data-role="assistant"]');
    await expect(assistantMsg).toHaveCount(1);

    const contentDiv = assistantMsg.locator('.msg-content');
    const textContent = await contentDiv.textContent();
    expect(textContent.length).toBeGreaterThan(0);
  });

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

  test('clear button removes all messages', async ({ page }) => {
    await openApp(page, 'success');
    await typeMessage(page, 'First message');
    await sendAndWait(page);

    // Verify messages appear
    await expect(page.locator('[data-testid="message-bubble"]')).toHaveCount(2);

    // Clear
    await page.locator('[data-testid="clear-chat-btn"]').click();
    await expect(page.locator('[data-testid="message-bubble"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible();
  });

  test('mode badge is visible for fake modes', async ({ page }) => {
    await openApp(page, 'success');
    await typeMessage(page, 'Check badge');
    await sendAndWait(page);

    const badge = page.locator('[data-testid="model-badge"]');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('mode:');
  });

  test('duplicate send suppressed while generating', async ({ page }) => {
    await openApp(page, 'timeout');
    await typeMessage(page, 'Wait');
    const sendBtn = page.locator('[data-testid="send-btn"]');

    // Click send
    await sendBtn.click();

    // Button should be immediately disabled
    await expect(sendBtn).toBeDisabled({ timeout: 2000 });

    // Wait for response eventually
    await page.waitForSelector('[data-testid="message-bubble"][data-role="assistant"]', { timeout: 10000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 3. FALLBACK BEHAVIOR — no model loaded, server returns fallback
// ═══════════════════════════════════════════════════════════════════════

test.describe('fallback behavior', () => {
  test('API returns fallback response structure for error mode (caught)', async ({ request }) => {
    // error mode throws, but server catches it
    const result = await apiChat(request, 'Test fallback', 'error');

    expect(result.model).toBe('fake');
    expect(result.finishReason).toBe('fallback');
    expect(typeof result.response).toBe('string');
    expect(result.response.length).toBeGreaterThan(0);
    expect(result.fallbackReason).toContain('FAKE_MODE_ERROR');
    expect(result.inspection).toBeDefined();
  });

  test('API always returns inspection data even on fallback', async ({ request }) => {
    const modes = ['success', 'empty', 'error', 'overlong'];
    for (const mode of modes) {
      const result = await apiChat(request, 'Inspect me', mode);
      expect(result.inspection, `mode=${mode}: inspection missing`).toBeDefined();
      expect(result.inspection.messageLength).toBe(10);
      expect(result.inspection.wordCount).toBe(2);
      expect(result.inspection.timestamp).toBeGreaterThan(0);
      // error mode returns fallback finish reason
      if (mode === 'error') {
        expect(result.finishReason).toBe('fallback');
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4. HORIZONTAL SPACING — equal left/right gutters
// ═══════════════════════════════════════════════════════════════════════

test.describe('horizontal spacing', () => {
  test('chat area is centered in viewport', async ({ page }) => {
    await openApp(page, 'success');
    await typeMessage(page, 'Test spacing');
    await sendAndWait(page);

    const chatBox = await page.evaluate(() => {
      const chat = document.querySelector('[data-testid="chat-area"]');
      const rect = chat.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    });

    expect(chatBox).toBeTruthy();

    const viewportWidth = await page.evaluate(() => window.innerWidth);
    const chatCenter = chatBox.left + chatBox.width / 2;
    const viewportCenter = viewportWidth / 2;
    expect(Math.abs(chatCenter - viewportCenter)).toBeLessThanOrEqual(2);
  });

  test('messages respect 85% max-width constraint', async ({ page }) => {
    await openApp(page, 'success');
    await typeMessage(page, 'Width test');
    await sendAndWait(page);

    const chatWidth = await page.evaluate(() => {
      const chat = document.querySelector('[data-testid="chat-area"]');
      return chat.getBoundingClientRect().width;
    });
    const maxAllowed = chatWidth * 0.85 + 1;

    const widths = await page.evaluate(() => {
      const bubbles = document.querySelectorAll('[data-testid="message-bubble"]');
      return Array.from(bubbles).map(b => b.getBoundingClientRect().width);
    });

    for (const w of widths) {
      expect(w).toBeLessThanOrEqual(maxAllowed);
    }
  });
});
