import { chromium } from 'playwright';
import { execSync, spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';

const DIST = path.resolve(process.cwd(), 'dist');
const PORT = 3724;
const LOCAL_URL = `http://127.0.0.1:${PORT}`;
const SHA = execSync('git rev-parse HEAD').toString().trim();

if (!existsSync(DIST)) {
  console.error('dist/ not found. Run `pnpm build` first.');
  process.exit(1);
}

async function main() {
  console.log(`\n=== Local production build verification for ${SHA} ===`);
  console.log(`URL: ${LOCAL_URL}\n`);

  // Start server
  const server = spawn('npx', ['serve', DIST, '-l', String(PORT), '-s', '--no-clipboard'], {
    stdio: 'pipe',
    cwd: process.cwd(),
  });
  server.stderr.on('data', d => process.stderr.write(d));

  // Wait for server
  await new Promise(resolve => setTimeout(resolve, 3000));

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  // ---------- PHASE 1: First load ----------
  console.log('=== PHASE 1: Initial load ===');

  const consoleLogs = [];
  const failedReqs = [];
  const allReqs = [];
  page.on('console', msg => consoleLogs.push({ type: msg.type(), text: msg.text() }));
  page.on('pageerror', err => consoleLogs.push({ type: 'error', text: err.message }));
  page.on('requestfailed', req => failedReqs.push({ url: req.url(), error: req.failure()?.errorText }));
  page.on('request', req => allReqs.push({ url: req.url(), method: req.method(), type: req.resourceType() }));

  const response = await page.goto(LOCAL_URL, { waitUntil: 'load', timeout: 15000 });
  console.log(`HTTP status: ${response?.status()}`);
  console.log(`Final URL: ${page.url()}`);

  // Give React a moment to render
  await page.waitForTimeout(2000);

  // Screenshot
  await page.screenshot({ path: 'scripts/local-prod-initial.png', fullPage: false });
  console.log('Screenshot: scripts/local-prod-initial.png');

  // DOM structure
  const hasRoot = await page.$('#root');
  console.log(`Has React root (#root): ${!!hasRoot}`);

  const rootChildren = await page.evaluate(() => document.getElementById('root')?.childElementCount || 0);
  console.log(`Root children: ${rootChildren}`);

  const pageTitle = await page.title();
  console.log(`Page title: ${pageTitle}`);

  // Get visible body text
  const bodyText = await page.evaluate(() => document.body?.innerText?.substring(0, 1500) || 'no body');
  console.log(`\n=== Visible text (first 1500 chars) ===`);
  console.log(bodyText);

  // Check for model/ollama references
  const modelRefs = await page.evaluate(() => {
    const all = document.body?.innerText || '';
    const lines = all.split('\n');
    return lines.filter(l =>
      l.toLowerCase().includes('ollama') ||
      l.toLowerCase().includes('smollm') ||
      l.toLowerCase().includes('model') ||
      l.toLowerCase().includes('qwen') ||
      l.toLowerCase().includes('load') ||
      l.toLowerCase().includes('status') ||
      l.toLowerCase().includes('fallback') ||
      l.toLowerCase().includes('ready')
    ).slice(0, 15);
  });

  // Console errors
  const errors = consoleLogs.filter(l => l.type === 'error');
  if (errors.length > 0) {
    console.log(`\n=== Console errors (${errors.length}) ===`);
    errors.forEach(e => {
      const text = e.text?.substring(0, 300);
      console.log(`  [${e.type}] ${text}`);
    });
  } else {
    console.log('\n✅ No console errors');
  }

  // Failed network requests
  const actualFailed = failedReqs.filter(r => !r.url.includes('ollama') && !r.url.includes('localhost:11434'));
  if (actualFailed.length > 0) {
    console.log(`\n=== Failed network requests (${actualFailed.length}) ===`);
    actualFailed.forEach(r => console.log(`  FAIL: ${r.url}`));
  } else {
    console.log('✅ No failed network requests (ignored expected Ollama fetch failures)');
  }

  // Model references in UI
  if (modelRefs.length > 0) {
    console.log('\n=== Model/status references in UI ===');
    modelRefs.forEach(l => console.log(`  "${l}"`));
  }

  // ---------- PHASE 2: Reload (service worker test) ----------
  console.log('\n=== PHASE 2: Reload (service worker test) ===');

  await page.waitForTimeout(1500);
  await page.reload({ waitUntil: 'load', timeout: 15000 });
  await page.waitForTimeout(2000);
  console.log('Reload complete');

  // Check SW
  const swInfo = await page.evaluate(async () => {
    try {
      const registrations = await navigator.serviceWorker?.getRegistrations();
      return registrations?.map(r => ({
        scope: r.scope,
        active: r.active?.state,
        installing: r.installing?.state,
        waiting: r.waiting?.state,
      })) || [];
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log(`Service worker registrations: ${JSON.stringify(swInfo)}`);

  // Check caches
  const swCaches = await page.evaluate(async () => {
    try {
      return await caches.keys();
    } catch (e) {
      return { error: e.message };
    }
  });
  console.log(`Cache storage keys: ${JSON.stringify(swCaches)}`);

  // Screenshot after reload
  await page.screenshot({ path: 'scripts/local-prod-reload.png', fullPage: false });
  console.log('Screenshot: scripts/local-prod-reload.png');

  await browser.close();
  server.kill();
  
  console.log(`\n=== Verification complete ===`);
  console.log(`SHA: ${SHA}`);
}

main().catch(e => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
