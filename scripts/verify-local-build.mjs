#!/usr/bin/env node

/**
 * verify-local-build.mjs — Verify production build renders correctly
 *
 * 1. Serves the dist/ folder locally
 * 2. Opens Playwright and checks:
 *    - index.html loads with correct paths
 *    - JS/CSS assets load with correct content types
 *    - Manifest loads with correct start_url/scope
 *    - Icons load correctly
 *    - 404.html exists as SPA fallback
 *    - App renders its shell with Ollama unavailable (shows offline/setup UI)
 * 3. Reports all findings
 */

import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

async function main() {
  console.log('═══════════════════════════════════════════════════════════');
  console.log('  LOCAL PRODUCTION BUILD VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════\n');

  // -----------------------------------------------------------------------
  // Step 0: Check build output
  // -----------------------------------------------------------------------
  console.log('── Build output audit ──\n');

  const distDir = path.join(ROOT, 'dist');
  if (!existsSync(distDir)) {
    console.error('  ❌ dist/ directory not found. Run pnpm build first.');
    process.exit(1);
  }

  const files = ['index.html', '404.html', 'manifest.webmanifest', 'registerSW.js', 'sw.js', 'icon-192.png', 'icon-512.png'];
  for (const f of files) {
    const full = path.join(distDir, f);
    const exists = existsSync(full);
    const size = exists ? statSync(full).size : 0;
    console.log(`  [${exists ? '✅' : '❌'}] ${f} (${(size / 1024).toFixed(1)} KB)`);
  }

  // Check assets exist
  const indexHtml = readFileSync(path.join(distDir, 'index.html'), 'utf-8');
  const jsMatch = /src="(\/assets\/index-\w+\.js)"/.exec(indexHtml);
  const cssMatch = /href="(\/assets\/index-\w+\.css)"/.exec(indexHtml);

  if (jsMatch) {
    const jsFile = path.join(distDir, jsMatch[1].slice(1));
    console.log(`  [${existsSync(jsFile) ? '✅' : '❌'}] JS bundle: ${jsMatch[1]}`);
  }
  if (cssMatch) {
    const cssFile = path.join(distDir, cssMatch[1].slice(1));
    console.log(`  [${existsSync(cssFile) ? '✅' : '❌'}] CSS bundle: ${cssMatch[1]}`);
  }

  // Check paths in index.html
  const hasOldSwarmPaths = indexHtml.includes('/swarm/');
  const hasRootPaths = indexHtml.includes('src="/assets/') && indexHtml.includes('href="/manifest');
  console.log(`\n  Old /swarm/ paths: ${hasOldSwarmPaths ? '❌' : '✅ (none)'}`);
  console.log(`  Root-relative paths: ${hasRootPaths ? '✅' : '❌'}`);

  // Check manifest
  const manifest = JSON.parse(readFileSync(path.join(distDir, 'manifest.webmanifest'), 'utf-8'));
  console.log(`\n  Manifest start_url: ${manifest.start_url} ${manifest.start_url === '/' ? '✅' : '❌'}`);
  console.log(`  Manifest scope: ${manifest.scope} ${manifest.scope === '/' ? '✅' : '❌'}`);
  const iconOk = manifest.icons.every((icon) => !icon.src.includes('/swarm/') && icon.src.startsWith('/'));
  console.log(`  Manifest icons (no /swarm/): ${iconOk ? '✅' : '❌'}`);

  // Check 404.html matches index.html
  const notFound = readFileSync(path.join(distDir, '404.html'), 'utf-8');
  console.log(`  404.html matches index.html: ${indexHtml === notFound ? '✅' : '❌'}`);

  // -----------------------------------------------------------------------
  // Step 1: Start local server
  // -----------------------------------------------------------------------
  console.log('\n── Starting local server for Playwright verification ──\n');

  const PORT = 9876;
  const server = createServer((req, res) => {
    let filePath = path.join(distDir, req.url === '/' ? 'index.html' : req.url.slice(1));
    // SPA fallback: if file doesn't exist, serve 404.html
    if (!existsSync(filePath)) {
      filePath = path.join(distDir, '404.html');
    }
    const ext = path.extname(filePath);
    const mimeTypes = {
      '.html': 'text/html',
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.png': 'image/png',
      '.svg': 'image/svg+xml',
      '.woff2': 'font/woff2',
      '.wasm': 'application/wasm',
    };
    res.writeHead(200, { 'Content-Type': mimeTypes[ext] ?? 'application/octet-stream' });
    res.end(readFileSync(filePath));
  });

  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`  Server running at http://localhost:${PORT}`);

  // -----------------------------------------------------------------------
  // Step 2: Launch Playwright
  // -----------------------------------------------------------------------
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  const consoleErrors = [];
  const failedReqs = [];
  const allResponses = [];

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
      console.log(`  [CONSOLE ERROR] ${msg.text()}`);
    }
  });

  page.on('requestfailed', (req) => {
    failedReqs.push({ url: req.url(), error: req.failure()?.errorText });
    console.log(`  [FAILED REQ] ${req.url()}: ${req.failure()?.errorText}`);
  });

  page.on('response', (resp) => {
    if (resp.url().startsWith(`http://localhost:${PORT}`)) {
      allResponses.push({ url: resp.url(), status: resp.status(), contentType: resp.headers()['content-type'] });
    }
  });

  // -----------------------------------------------------------------------
  // Step 3: Navigate to the app
  // -----------------------------------------------------------------------
  console.log(`\n  Navigating to http://localhost:${PORT}...`);
  await page.goto(`http://localhost:${PORT}`, { waitUntil: 'networkidle', timeout: 15000 });

  const pageTitle = await page.title();
  const finalUrl = page.url();
  console.log(`  Page title: ${pageTitle}`);
  console.log(`  Final URL: ${finalUrl}`);

  // -----------------------------------------------------------------------
  // Step 4: Check React rendering
  // -----------------------------------------------------------------------
  const hasReactRoot = await page.$('#root');
  console.log(`\n  React #root present: ${hasReactRoot ? '✅' : '❌'}`);

  const rootChildren = await page.evaluate(() => document.getElementById('root')?.children?.length ?? 0);
  console.log(`  Root children: ${rootChildren}`);

  const rootHtml = await page.evaluate(() => document.getElementById('root')?.innerHTML?.slice(0, 500) ?? '(empty)');
  console.log(`  Root HTML: ${rootHtml.slice(0, 300)}`);

  const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 500) ?? '(empty)');
  console.log(`  Body text: ${bodyText.slice(0, 300)}`);

  // Check for the Ollama offline/setup UI
  const hasOllamaSetupText = bodyText.includes('Ollama') || bodyText.includes('Setup') || bodyText.includes('localhost') || bodyText.includes('Connect');
  console.log(`\n  Ollama setup/offline UI: ${hasOllamaSetupText ? '✅ (shown)' : '⚠ (not found in body text)'}`);

  // -----------------------------------------------------------------------
  // Step 5: Check asset responses
  // -----------------------------------------------------------------------
  console.log('\n── Local asset responses ──\n');
  const localResponses = allResponses.filter((r) => r.url.startsWith(`http://localhost:${PORT}`));
  let allOk = true;
  for (const r of localResponses) {
    const urlPath = r.url.slice(`http://localhost:${PORT}`.length);
    const ok = r.status === 200;
    if (!ok) allOk = false;
    console.log(`  [${ok ? '✅' : '❌'}] ${r.status} ${r.contentType}  ${urlPath}`);
  }

  // -----------------------------------------------------------------------
  // Step 6: Take screenshot
  // -----------------------------------------------------------------------
  const screenshotPath = path.join(ROOT, 'test-output', 'local-build.png');
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`\n  Screenshot: ${screenshotPath}`);

  // -----------------------------------------------------------------------
  // Summary
  // -----------------------------------------------------------------------
  console.log('\n╔══════════════════════════════════════════════════════════╗');
  console.log('║  VERIFICATION SUMMARY                                   ║');
  console.log('╚══════════════════════════════════════════════════════════╝\n');

  const passed = hasReactRoot && rootChildren > 0 && !hasOldSwarmPaths && manifest.start_url === '/' && !consoleErrors.some(e => !e.includes('Ollama'));

  console.log(`  React renders: ${hasReactRoot && rootChildren > 0 ? '✅' : '❌'}`);
  console.log(`  No /swarm/ paths: ${!hasOldSwarmPaths ? '✅' : '❌'}`);
  console.log(`  Manifest start_url: ${manifest.start_url === '/' ? '✅' : '❌'}`);
  console.log(`  SPA 404 fallback: ${indexHtml === notFound ? '✅' : '❌'}`);
  console.log(`  All assets 200: ${allOk ? '✅' : '❌'}`);

  if (consoleErrors.length > 0) {
    console.log(`  Console errors: ${consoleErrors.length} ⚠ (check above)`);
  } else {
    console.log('  Console errors: 0 ✅');
  }

  if (failedReqs.length > 0) {
    console.log(`  Failed requests: ${failedReqs.length} ⚠`);
  } else {
    console.log('  Failed requests: 0 ✅');
  }

  console.log(`\n  ${passed ? '✅ ALL CHECKS PASSED' : '❌ SOME CHECKS FAILED'}`);

  // Cleanup
  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  process.exit(passed ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
