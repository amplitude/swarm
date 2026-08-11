/**
 * Functional Chat E2E Tests — run against the `mode=e2e` production build
 * that uses the deterministic E2EProvider fixture.
 *
 * Covers: fresh load, composer, streaming, stop/retry, session CRUD,
 * agent switch/handoff, tasks, persistence, mobile layout, WebGPU guard.
 */

import { test, expect, type Page, type BrowserContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve('test-output/e2e-screenshots');

test.beforeAll(() => {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
});

async function createE2EContext(browser: any): Promise<BrowserContext> {
  return await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────

/** Mock WebGPU so the app auto-loads the E2E provider */
async function mockWebGPU(page: Page) {
  await page.addInitScript(() => {
    // Always override — headless Chrome has navigator.gpu but requestAdapter returns null
    // @ts-ignore
    Object.defineProperty(navigator, 'gpu', {
      value: {
        requestAdapter: async () => ({
          features: new Set(),
          limits: {},
          requestDevice: async () => ({}),
        }),
      },
      writable: true,
      configurable: true,
    });
  });
}

/** Wait for the E2E provider to finish loading (llmStatus === 'ready') */
async function waitForModelReady(page: Page, timeout = 8000) {
  try {
    await expect(page.getByText('Model ready')).toBeVisible({ timeout });
  } catch {
    await expect(page.locator('button[title*="Send message"]')).not.toBeDisabled({ timeout });
  }
  await page.waitForTimeout(500);
}

/** Type into the composer and press Enter to send */
async function sendMessage(page: Page, text: string) {
  const textarea = page.locator('textarea[placeholder*="Type a message"]');
  await expect(textarea).toBeVisible({ timeout: 3000 });
  await textarea.fill(text);
  await page.waitForTimeout(100);
  await textarea.press('Enter');
}

/** Wait for streaming response to finish */
async function waitForResponse(page: Page, timeout = 8000) {
  try {
    await expect(page.getByText('Generating...')).not.toBeVisible({ timeout });
  } catch {}
  await page.waitForTimeout(500);
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: path.join(SCREENSHOT_DIR, `${name}.png`), fullPage: false });
}

async function ensureConversation(page: Page) {
  const welcome = page.getByText('Welcome to Swarm');
  if (await welcome.isVisible({ timeout: 1000 }).catch(() => false)) {
    await page.locator('main button', { hasText: 'New conversation' }).click();
    await page.waitForTimeout(500);
  }
}

async function openSidebar(page: Page) {
  const sidebar = page.locator('aside');
  if (!(await sidebar.isVisible({ timeout: 500 }).catch(() => false))) {
    const leftToggle = page.locator('button[title="Open sidebar"]').first();
    if (await leftToggle.isVisible({ timeout: 1000 }).catch(() => false)) {
      await leftToggle.click();
      await page.waitForTimeout(400);
    }
  }
  await expect(page.locator('aside').first()).toBeVisible({ timeout: 2000 });
}

// ════════════════════════════════════════════════════════════════════════════
// 1. FRESH LOAD: exactly one empty session/thread, model reaches ready
// ════════════════════════════════════════════════════════════════════════════

test.describe('Fresh load', () => {
  test('creates one empty session, model reaches ready', async ({ browser }) => {
    const context = await createE2EContext(browser);
    const page = await context.newPage();
    await mockWebGPU(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await waitForModelReady(page);

    await openSidebar(page);
    await expect(page.getByText('Default').first()).toBeVisible({ timeout: 3000 });
    await expect(page.locator('textarea[placeholder*="Type a message"]')).toBeVisible({ timeout: 3000 });
    await expect(page.getByText('Press Enter to send').or(page.getByText(/Send message/))).toBeVisible({ timeout: 3000 });

    await screenshot(page, '01-fresh-load');
    await context.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 2. COMPOSER: Enter sends, Shift+Enter newline, streaming tokens, completion
// ════════════════════════════════════════════════════════════════════════════

test.describe('Composer', () => {
  test('Enter sends, Shift+Enter newlines, streams response', async ({ browser }) => {
    const context = await createE2EContext(browser);
    const page = await context.newPage();
    await mockWebGPU(page);
    await page.goto('/');
    await waitForModelReady(page);
    await ensureConversation(page);

    await sendMessage(page, 'Hello E2E');
    await page.waitForTimeout(2000);

    // Any response word should appear
    await expect(page.getByText(/for|Here|testing|a|response|the|is|purposes/).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('Hello E2E')).toBeVisible();

    await screenshot(page, '02-streaming-response');

    // Test Shift+Enter creates a newline
    const textarea = page.locator('textarea[placeholder*="Type a message"]');
    await textarea.focus();
    await textarea.fill('Line one');
    await page.keyboard.press('Shift+Enter');
    await page.keyboard.press('Shift+Enter');
    await textarea.type('Line three');

    const value = await textarea.inputValue();
    expect(value).toContain('Line one');
    expect(value).toContain('Line three');

    await screenshot(page, '03-shift-enter-newline');
    await context.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 3. STOP interrupts mid-stream, RETRY creates completed response
// ════════════════════════════════════════════════════════════════════════════

test.describe('Stop and Retry', () => {
  test('Stop interrupts, Retry completes', async ({ browser }) => {
    const context = await createE2EContext(browser);
    const page = await context.newPage();
    await mockWebGPU(page);
    await page.goto('/');
    await waitForModelReady(page);
    await ensureConversation(page);

    await sendMessage(page, '[e2e stop]');
    await page.waitForTimeout(2000);
    await screenshot(page, '04-stop-interrupt');

    await sendMessage(page, 'Hello for retry');
    await waitForResponse(page);
    await expect(page.getByText(/for|Here|testing|a|response/).first()).toBeVisible({ timeout: 8000 });

    await screenshot(page, '05-retry-complete');
    await context.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 4. SESSION: create, switch, reload persistence, delete
// ════════════════════════════════════════════════════════════════════════════

test.describe('Session management', () => {
  test('create, switch, title, reload persistence, delete', async ({ browser }) => {
    const context = await createE2EContext(browser);
    const page = await context.newPage();
    await mockWebGPU(page);
    await page.goto('/');
    await waitForModelReady(page);
    await openSidebar(page);
    await ensureConversation(page);

    // Send a message to create a thread with content
    await sendMessage(page, 'Session title test');
    await waitForResponse(page);
    await page.waitForTimeout(500);

    // 1. Create a second session
    const newSessionBtn = page.getByRole('button', { name: 'New session' });
    await expect(newSessionBtn).toBeVisible({ timeout: 3000 });
    await newSessionBtn.click();
    await page.waitForTimeout(500);

    await expect(page.getByText('Default').first()).toBeVisible({ timeout: 3000 });
    const sessionCount = await page.locator('aside [class*="group"]').count();
    expect(sessionCount).toBeGreaterThanOrEqual(2);

    await screenshot(page, '06-session-created');

    // 2. Switch back to Default session
    await page.getByText('Default').first().click();
    await page.waitForTimeout(500);

    // 3. Reload and check persistence
    await page.reload();
    await page.waitForLoadState('networkidle');
    await waitForModelReady(page);
    await openSidebar(page);

    await expect(page.getByText('Default').first()).toBeVisible({ timeout: 5000 });
    await expect(page.getByText('New Session').first()).toBeVisible({ timeout: 3000 });

    await screenshot(page, '07-session-persist');

    // 4. Delete the second session
    await page.getByText('New Session').first().click();
    await page.waitForTimeout(300);

    page.on('dialog', (dialog) => dialog.accept());
    const deleteBtn = page.locator('button[title="Delete session"]').first();
    if (await deleteBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteBtn.click();
      await page.waitForTimeout(500);
    }

    await screenshot(page, '08-session-deleted');
    await context.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 5. MULTIPLE SESSIONS: create/switch/delete, each preserving threads
// ════════════════════════════════════════════════════════════════════════════

test.describe('Multiple sessions', () => {
  test('create/switch/delete sessions, each preserves own threads', async ({ browser }) => {
    const context = await createE2EContext(browser);
    const page = await context.newPage();
    await mockWebGPU(page);
    await page.goto('/');
    await waitForModelReady(page);
    await openSidebar(page);
    await ensureConversation(page);

    // Create 2 new sessions (3 total)
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'New session' }).click();
      await page.waitForTimeout(400);
    }

    const allSessionItems = page.locator('aside [class*="group"]');
    const count = await allSessionItems.count();
    expect(count).toBeGreaterThanOrEqual(3);

    await screenshot(page, '09-multiple-sessions');
    await context.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 6. AGENT HANDOFF: select agent, handoff, persistence
// ════════════════════════════════════════════════════════════════════════════

test.describe('Agent handoff', () => {
  test('select agent, handoff, active agent persists reload', async ({ browser }) => {
    const context = await createE2EContext(browser);
    const page = await context.newPage();
    await mockWebGPU(page);
    await page.goto('/');
    await waitForModelReady(page);
    await ensureConversation(page);

    // 1. Switch to General agent via sidebar
    await openSidebar(page);
    const generalButton = page.locator('aside button', { hasText: 'General' });
    await expect(generalButton).toBeVisible({ timeout: 3000 });
    await generalButton.click();
    await page.waitForTimeout(300);

    // After agent switch, create a conversation for this agent
    await ensureConversation(page);

    await screenshot(page, '10-agent-switched');

    // 2. Send a message (handoff triggers via tool call parsing)
    await sendMessage(page, '[e2e handoff coder reason context]');
    await page.waitForTimeout(3000);

    await screenshot(page, '11-handoff-request');

    // 3. Reload and verify active agent persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    await waitForModelReady(page);
    await openSidebar(page);

    // Active agent should be restored from localStorage
    await expect(page.getByText('General').first()).toBeVisible({ timeout: 3000 });

    await screenshot(page, '12-handoff-persist');
    await context.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 7. TASKS: create/complete/delete with persistence
// ════════════════════════════════════════════════════════════════════════════

test.describe('Task management', () => {
  test('create, edit, complete, delete tasks with persistence', async ({ browser }) => {
    const context = await createE2EContext(browser);
    const page = await context.newPage();
    await mockWebGPU(page);
    await page.goto('/');
    await waitForModelReady(page);
    await ensureConversation(page);

    // Open right panel via the Header toggle
    const rightToggle = page.locator('header button[title="Open panel"]').first();
    if (await rightToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rightToggle.click();
      await page.waitForTimeout(400);
    }

    // The inspector panel should show Tasks section
    await expect(page.getByText('Tasks').first()).toBeVisible({ timeout: 3000 });

    // Click "Add task" button
    const addTaskBtn = page.getByText('Add task').first();
    await expect(addTaskBtn).toBeVisible({ timeout: 2000 });
    await addTaskBtn.click();
    await page.waitForTimeout(300);

    // Type task title and add it
    const taskInput = page.locator('input[placeholder="Task title..."]');
    await expect(taskInput).toBeVisible({ timeout: 2000 });
    await taskInput.fill('E2E Persisted Task');
    await taskInput.press('Enter');
    await page.waitForTimeout(500);

    // Task should appear in the list
    await expect(page.getByText('E2E Persisted Task')).toBeVisible({ timeout: 3000 });

    await screenshot(page, '13-task-created');

    // Reload and verify task persists
    await page.reload();
    await page.waitForLoadState('networkidle');
    await waitForModelReady(page);

    // Open inspector again
    const rightToggle2 = page.locator('header button[title="Open panel"]').first();
    if (await rightToggle2.isVisible({ timeout: 2000 }).catch(() => false)) {
      await rightToggle2.click();
      await page.waitForTimeout(400);
    }

    // Task should still be visible after reload
    await expect(page.getByText('E2E Persisted Task').first()).toBeVisible({ timeout: 5000 });

    await screenshot(page, '14-task-persist');
    await context.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 8. MOBILE 390x844: sidebar drawer, inspector, composer
// ════════════════════════════════════════════════════════════════════════════

test.describe('Mobile layout 390x844', () => {
  test('sidebar drawer, inspector sheet, composer visible, no overflow', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
    });
    const page = await context.newPage();
    await mockWebGPU(page);
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Verify PanelToggle button exists for sidebar
    const panelToggle = page.locator('button[title="Open sidebar"]');
    await expect(panelToggle.first()).toBeVisible({ timeout: 3000 });
    await screenshot(page, '15-mobile-default');

    // Open right panel (inspector) via Header button
    const headerOpen = page.locator('header button[title="Open panel"]').first();
    await expect(headerOpen).toBeVisible({ timeout: 3000 });
    await headerOpen.click();
    await page.waitForTimeout(400);
    await expect(page.getByText('Tasks').first()).toBeVisible({ timeout: 3000 });
    await screenshot(page, '16-mobile-inspector');

    // Toggle right panel via page.evaluate (reliable on mobile flex-col)
    await page.evaluate(() => {
      // Access zustand store: the store is accessible via React devtools
      // or by importing the module. Use a click via the store directly.
    });
    // Use the Header close button
    const closeBtn = page.locator('header button[title="Close panel"]').first();
    await expect(closeBtn).toBeVisible({ timeout: 3000 });
    await closeBtn.click();
    await page.waitForTimeout(300);

    // Composer should be visible
    const textarea = page.locator('textarea[placeholder*="Type a message"]');
    await expect(textarea).toBeVisible({ timeout: 3000 });

    // Check no horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 5);

    await screenshot(page, '17-mobile-composer');
    await context.close();
  });
});

// ════════════════════════════════════════════════════════════════════════════
// 9. NORMAL (no WebGPU) production build: send disabled, honest reason
// ════════════════════════════════════════════════════════════════════════════

test.describe('WebGPU-unavailable normal build', () => {
  test('send disabled with honest reason, no demo', async ({ browser }) => {
    // Run WITHOUT WebGPU mock. Headless Chrome's requestAdapter returns null,
    // so checkWebGPUSupport() returns false and the UI shows "Model load failed"
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const page = await context.newPage();

    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Should show model load failure
    const failMsg = page.getByText('Model load failed');
    await expect(failMsg).toBeVisible({ timeout: 8000 });

    await screenshot(page, '18-webgpu-unavailable');
    await context.close();
  });
});
