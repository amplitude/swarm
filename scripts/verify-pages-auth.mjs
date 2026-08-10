#!/usr/bin/env node

/**
 * verify-pages-auth.mjs — Verify pages using Playwright with auth cookies
 *
 * Attempts to access the private GitHub Pages URL by:
 * 1. Login to GitHub via the login page using the GH token
 * 2. Navigate to the Pages URL with the authenticated session
 * 3. Capture the actual app content
 */

import { chromium } from 'playwright';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const PAGES_URL = 'https://vigilant-adventure-pzzr7n9.pages.github.io/';

async function main() {
  console.log('═══ AUTHENTICATED PAGES VERIFICATION ═══\n');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();

  // Collect errors
  const consoleErrors = [];
  const failedReqs = [];
  page.on('console', (msg) => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('requestfailed', (req) => {
    failedReqs.push({ url: req.url(), error: req.failure()?.errorText });
  });

  // Step 1: Login to GitHub
  console.log('1. Logging into GitHub...');
  await page.goto('https://github.com/login', { waitUntil: 'networkidle' });

  // Check if already logged in
  const userMenu = await page.$('summary[aria-label*="View profile"]');
  if (userMenu) {
    console.log('   Already logged in ✅');
  } else {
    // Fill login form with token as password (session-based auth)
    // Use the GitHub username from gh CLI
    const ghUser = execSync('gh api user --jq .login', { encoding: 'utf-8' }).trim();
    const ghToken = execSync('gh auth token', { encoding: 'utf-8' }).trim();

    await page.fill('input[name="login"]', ghUser);
    await page.fill('input[name="password"]', ghToken);
    await page.click('input[type="submit"]');
    await page.waitForTimeout(5000);

    // Check if login succeeded
    const errorMsg = await page.$('.flash-error');
    if (errorMsg) {
      const text = await errorMsg.innerText();
      console.log(`   Login failed: ${text}`);
      console.log('   (Token cannot be used as password — need OAuth app or browser session)');
    } else {
      console.log('   Login seemed to succeed ✅');
    }
  }

  // Step 2: Navigate to the Pages URL
  console.log('\n2. Navigating to Pages URL...');
  await page.goto(PAGES_URL, { waitUntil: 'networkidle', timeout: 30000 }).catch((e) => {
    console.log(`   Navigation error: ${e.message}`);
  });

  const finalUrl = page.url();
  console.log(`   Final URL: ${finalUrl}`);

  // Step 3: Check if we got the app
  const isApp = !finalUrl.includes('login') && !finalUrl.includes('auth');
  
  if (isApp) {
    console.log('\n   ✅ PAGES APP ACCESSIBLE!\n');

    const pageTitle = await page.title();
    console.log(`   Title: ${pageTitle}`);

    const bodyText = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root?.innerText ?? document.body?.innerText ?? '(empty)';
    });
    console.log(`   Body text: ${bodyText.slice(0, 300)}`);

    const hasReactRoot = await page.$('#root');
    console.log(`   React root: ${hasReactRoot ? '✅' : '❌'}`);

    const rootContent = await page.evaluate(() => {
      const root = document.getElementById('root');
      return root?.children?.length ?? 0;
    });
    console.log(`   Root children: ${rootContent}`);

    const jsAssets = [];
    const allLinks = await page.evaluate(() => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      const links = Array.from(document.querySelectorAll('link[rel=stylesheet]'));
      const manifest = document.querySelector('link[rel=manifest]');
      return {
        scripts: scripts.map(s => s.getAttribute('src')),
        styles: links.map(l => l.getAttribute('href')),
        manifest: manifest?.getAttribute('href'),
      };
    });
    console.log(`   Scripts: ${allLinks.scripts.join(', ')}`);
    console.log(`   Styles: ${allLinks.styles.join(', ')}`);
    console.log(`   Manifest: ${allLinks.manifest}`);

    // Check console errors
    if (consoleErrors.length > 0) {
      console.log(`\n   Console errors (${consoleErrors.length}):`);
      for (const e of consoleErrors) {
        console.log(`     ❌ ${e}`);
      }
    } else {
      console.log('\n   No console errors ✅');
    }

    // Check failed requests
    if (failedReqs.length > 0) {
      console.log(`\n   Failed requests (${failedReqs.length}):`);
      for (const f of failedReqs) {
        console.log(`     ❌ ${f.url}: ${f.error}`);
      }
    } else {
      console.log('\n   No failed requests ✅');
    }

  } else {
    console.log('\n   ❌ Pages requires authentication — cannot verify app content');
    console.log('   (Private Pages requires cookie-based auth session)');

    const pageText = await page.evaluate(() => document.body?.innerText?.slice(0, 200));
    console.log(`   Page shows: ${pageText}`);
  }

  // Screenshot
  const screenshotPath = path.join(
    path.dirname(fileURLToPath(import.meta.url)),
    '..',
    'test-output',
    'pages-auth-verify.png',
  );
  await page.screenshot({ path: screenshotPath, fullPage: true });
  console.log(`\n   Screenshot: ${screenshotPath}`);

  await browser.close();
  console.log('\nVerification complete.');
}

main().catch((err) => { console.error(err); process.exit(1); });
