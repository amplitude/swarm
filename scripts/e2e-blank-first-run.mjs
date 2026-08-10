#!/usr/bin/env node

/**
 * e2e-blank-first-run.mjs — Real clean-browser E2E proof
 *
 * Launches Playwright Chromium with a brand-new temporary --user-data-dir,
 * navigates to the production build (pnpm preview), and captures:
 *   - Desktop screenshot (1280×720)
 *   - Mobile screenshot (375×812)
 *   - DOM text showing the visible welcome/empty-state CTA
 *   - localStorage contents (proving zero swarm-* keys before interaction)
 *   - IndexedDB conversation count (proving zero stored conversations)
 *
 * Usage:
 *   1. pnpm build          # production build
 *   2. node scripts/e2e-blank-first-run.mjs
 *
 * Requires: playwright (dev dependency)
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');
const SCREENSHOT_DIR = join(ROOT, 'docs', 'screenshots');
const OUT_FILE = join(ROOT, 'test-output', 'e2e-blank-first-run.json');

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(join(ROOT, 'test-output'), { recursive: true });

// ---------------------------------------------------------------------------
// Step 0: Start preview server
// ---------------------------------------------------------------------------

async function startPreview() {
  return new Promise((resolve, reject) => {
    const proc = spawn('pnpm', ['preview', '--host', '127.0.0.1', '--port', '5199'], {
      cwd: ROOT,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    let output = '';
    const timeout = setTimeout(() => {
      reject(new Error('Preview server did not start in 15s. output:\n' + output));
    }, 15000);

    proc.stdout.on('data', (data) => {
      output += data.toString();
      if (output.includes('Local') || output.includes('http://')) {
        clearTimeout(timeout);
        // Give it a moment to be fully ready
        setTimeout(() => resolve(proc), 1000);
      }
    });

    proc.stderr.on('data', (data) => {
      output += data.toString();
      if (output.includes('Local') || output.includes('http://')) {
        clearTimeout(timeout);
        setTimeout(() => resolve(proc), 1000);
      }
    });

    proc.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    proc.on('exit', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`Preview server exited with code ${code}\n${output}`));
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Step 1: Launch clean browser, capture evidence
// ---------------------------------------------------------------------------

async function runE2E() {
  console.log('═══ E2E: Blank First Run (real clean browser) ═══\n');

  // Start preview server
  console.log('Starting preview server...');
  const server = await startPreview();
  const BASE_URL = 'http://127.0.0.1:5199/swarm/';
  console.log(`Preview server ready at ${BASE_URL}\n`);

  // Create a temporary user-data-dir
  const tmpDir = join(ROOT, 'test-output', 'e2e-profile-' + Date.now());

  const evidence = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    viewports: {},
    localStorage: {},
    indexedDB: {},
    dom: {},
    screenshots: {},
    assertions: {},
  };

  try {
    // Launch browser with clean profile
    console.log('Launching Chromium with fresh --user-data-dir...');
    const browser = await chromium.launchPersistentContext(tmpDir, {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-gpu',
        '--disable-dev-shm-usage',
      ],
    });

    const page = await browser.newPage();

    // --- Desktop viewport ---
    console.log('Setting desktop viewport (1280×720)...');
    await page.setViewportSize({ width: 1280, height: 720 });

    console.log(`Navigating to ${BASE_URL}...`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(2000); // Let React render

    // Screenshot: desktop
    const desktopScreenshot = join(SCREENSHOT_DIR, 'blank-first-run.png');
    await page.screenshot({ path: desktopScreenshot, fullPage: false });
    evidence.screenshots.desktop = desktopScreenshot;
    console.log(`Desktop screenshot saved: ${desktopScreenshot}`);

    // Get desktop screenshot dimensions
    const desktopSize = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    }));
    evidence.viewports.desktop = desktopSize;
    console.log(`Desktop viewport dimensions: ${desktopSize.width}×${desktopSize.height}`);

    // --- DOM text: capture visible text content ---
    const visibleText = await page.evaluate(() => {
      // Helper to get all visible text
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            const el = node.parentElement;
            if (!el) return NodeFilter.FILTER_REJECT;
            const style = window.getComputedStyle(el);
            if (style.display === 'none' || style.visibility === 'hidden') {
              return NodeFilter.FILTER_REJECT;
            }
            return NodeFilter.FILTER_ACCEPT;
          },
        },
      );
      const texts = [];
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent.trim();
        if (t) texts.push(t);
      }
      return texts;
    });
    evidence.dom.visibleText = visibleText;
    console.log('Visible DOM text:');
    visibleText.forEach(t => console.log(`  "${t}"`));

    // --- localStorage scan ---
    const lsData = await page.evaluate(() => {
      const all = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) all[key] = localStorage.getItem(key);
      }
      return all;
    });
    evidence.localStorage.allKeys = lsData;
    evidence.localStorage.swarmKeys = Object.keys(lsData).filter(k => k.startsWith('swarm-'));
    console.log(`localStorage keys: ${Object.keys(lsData).length}`);
    console.log(`  swarm-* keys: ${evidence.localStorage.swarmKeys.length}`);
    if (evidence.localStorage.swarmKeys.length > 0) {
      console.log(`  Found: ${evidence.localStorage.swarmKeys.join(', ')}`);
    }

    // --- IndexedDB scan ---
    const idbData = await page.evaluate(async () => {
      const databases = await indexedDB.databases();
      const results = {};
      for (const dbInfo of databases) {
        if (!dbInfo.name) continue;
        const dbName = dbInfo.name;
        results[dbName] = { objectStores: [], counts: {} };
        const db = await new Promise((resolve, reject) => {
          const req = indexedDB.open(dbName);
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
        const storeNames = [];
        for (let i = 0; i < db.objectStoreNames.length; i++) {
          storeNames.push(db.objectStoreNames[i]);
        }
        results[dbName].objectStores = storeNames;
        for (const storeName of storeNames) {
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const count = await new Promise(function(resolve, reject) {
            const req = store.count();
            req.onsuccess = function() { resolve(req.result); };
            req.onerror = function() { reject(req.error); };
          });
          results[dbName].counts[storeName] = count;
        }
        db.close();
      }
      return results;
    }).catch(function(err) { return { error: String(err) }; });
    evidence.indexedDB.databases = idbData;
    console.log(`IndexedDB databases:`, JSON.stringify(idbData, null, 2));

    // --- Mobile screenshot ---
    console.log('\nSetting mobile viewport (375×812)...');
    await page.setViewportSize({ width: 375, height: 812 });
    await sleep(500);

    const mobileScreenshot = join(SCREENSHOT_DIR, 'blank-first-run-mobile.png');
    await page.screenshot({ path: mobileScreenshot, fullPage: false });
    evidence.screenshots.mobile = mobileScreenshot;
    console.log(`Mobile screenshot saved: ${mobileScreenshot}`);

    const mobileSize = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    }));
    evidence.viewports.mobile = mobileSize;
    console.log(`Mobile viewport: ${mobileSize.width}×${mobileSize.height}`);

    // --- Assertions ---
    const titleText = visibleText.some(t =>
      t.includes('Swarm')
    );
    const ctaText = visibleText.some(t =>
      t.includes('Send a message to start') ||
      t.includes('conversation') ||
      t.includes('start')
    );
    const noConversationKeys = !evidence.localStorage.swarmKeys.some(k =>
      k.includes('conversation') || k.includes('messages')
    );
    const zeroConversationsInDB =
      evidence.indexedDB.databases &&
      !evidence.indexedDB.databases.error &&
      Object.values(evidence.indexedDB.databases).every(
        (db) => db.counts.conversations === 0 && db.counts.messages === 0
      );

    evidence.assertions = {
      titleTextVisible: titleText,
      ctaVisible: ctaText,
      noStoredConversations: noConversationKeys && zeroConversationsInDB,
      localStoragePreferenceKeys: evidence.localStorage.swarmKeys,
      zeroConversationsInDB,
      zeroMessagesInDB: Object.values(evidence.indexedDB.databases || {}).every(
        (db) => db.counts.messages === 0
      ),
    };

    console.log('\n--- ASSERTIONS ---');
    console.log(`  Title "Swarm" visible: ${titleText}`);
    console.log(`  CTA visible: ${ctaText}`);
    console.log(`  No stored conversations: ${noConversationKeys && zeroConversationsInDB}`);
    console.log(`  localStorage preference keys: ${evidence.localStorage.swarmKeys.join(', ')}`);
    console.log(`  Zero conversations in IndexedDB: ${zeroConversationsInDB}`);

    await browser.close();
  } finally {
    // Clean up: kill preview server
    server.kill('SIGTERM');
    console.log('\nPreview server stopped.');
  }

  // Write evidence JSON
  writeFileSync(OUT_FILE, JSON.stringify(evidence, null, 2));
  console.log(`\nEvidence saved to ${OUT_FILE}`);

  // Clean up the temp profile
  try {
    const { rmSync } = await import('fs');
    rmSync(tmpDir, { recursive: true, force: true });
    console.log(`Temp profile cleaned: ${tmpDir}`);
  } catch {}

  return evidence;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

runE2E()
  .then((evidence) => {
    const pass = evidence.assertions.titleTextVisible &&
                 evidence.assertions.ctaVisible &&
                 evidence.assertions.noStoredConversations;
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`E2E BLANK FIRST RUN: ${pass ? 'PASS' : 'FAIL'}`);
    console.log(`${'═'.repeat(50)}`);
    process.exit(pass ? 0 : 1);
  })
  .catch((err) => {
    console.error('E2E Error:', err);
    process.exit(1);
  });
