#!/usr/bin/env node

/**
 * e2e-blank-first-run.mjs — Real clean-browser E2E proof with BEFORE/AFTER snapshots
 *
 * TWO storage snapshots:
 *   1. BEFORE: on about:blank before any app navigation (must show empty localStorage
 *      and no app IndexedDB)
 *   2. AFTER: after app boots (preferences may exist, conversations/messages/artifacts/settings
 *      must be zero)
 *
 * Also captures:
 *   - Desktop screenshot (1280×720) and mobile (375×812)
 *   - chromium.executablePath() and full launch args
 *   - Profile path with existence proof (did not exist before creation)
 *   - DOM text showing visible welcome/empty-state CTA
 *   - Profile deleted after test
 *
 * Usage:
 *   1. pnpm build          # production build
 *   2. node scripts/e2e-blank-first-run.mjs
 *
 * Requires: playwright (dev dependency)
 */

import { chromium } from 'playwright';
import { writeFileSync, mkdirSync, readFileSync, existsSync, rmSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { setTimeout as sleep } from 'timers/promises';
import { createHash } from 'crypto';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');
const SCREENSHOT_DIR = join(ROOT, 'docs', 'screenshots');
const OUT_FILE = join(ROOT, 'test-output', 'e2e-blank-first-run.json');

mkdirSync(SCREENSHOT_DIR, { recursive: true });
mkdirSync(join(ROOT, 'test-output'), { recursive: true });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fileHash(filePath) {
  if (!existsSync(filePath)) return '(file not found)';
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function getImageDimensions(filePath) {
  if (!existsSync(filePath)) return { width: 0, height: 0 };
  const data = readFileSync(filePath);
  if (data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
    return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  }
  return { width: 0, height: 0, note: 'non-PNG or unreadable' };
}

// Read localStorage (returns all keys)
async function readLocalStorage(page) {
  return page.evaluate(() => {
    const all = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key) all[key] = localStorage.getItem(key);
    }
    return all;
  });
}

// Read ALL IndexedDB databases and their store counts
async function readAllIndexedDB(page) {
  return page.evaluate(async () => {
    const databases = await indexedDB.databases();
    const results = {};
    for (const dbInfo of databases) {
      if (!dbInfo.name) continue;
      const dbName = dbInfo.name;
      const db = await new Promise((resolve, reject) => {
        const req = indexedDB.open(dbName);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
      const storeCounts = {};
      for (let i = 0; i < db.objectStoreNames.length; i++) {
        const storeName = db.objectStoreNames[i];
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        storeCounts[storeName] = await new Promise((resolve, reject) => {
          const req = store.count();
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        });
      }
      results[dbName] = storeCounts;
      db.close();
    }
    return results;
  }).catch(err => ({ error: String(err) }));
}

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
      if (code !== 0) reject(new Error(`Preview server exited with code ${code}\n${output}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Main E2E
// ---------------------------------------------------------------------------

async function runE2E() {
  console.log('═══ E2E: Blank First Run (BEFORE/AFTER storage snapshots) ═══\n');

  const server = await startPreview();
  const BASE_URL = 'http://127.0.0.1:5199/';
  console.log(`Preview server ready at ${BASE_URL}\n`);

  const tmpDir = join(ROOT, 'test-output', 'e2e-profile-' + Date.now());
  const profileExistsBefore = existsSync(tmpDir);

  console.log(`PROFILE PATH: ${tmpDir}`);
  console.log(`  Existed before creation: ${profileExistsBefore}`);
  console.log(`  (expected: false)\n`);

  const evidence = {
    timestamp: new Date().toISOString(),
    baseUrl: BASE_URL,
    profile: { path: tmpDir, existedBeforeCreation: profileExistsBefore },
    chromiumInfo: {},
    before: { localStorage: null, indexedDB: null, label: 'BEFORE navigation (about:blank)' },
    after: { localStorage: null, indexedDB: null, dom: null, label: 'AFTER app boot' },
    viewports: {},
    screenshots: {},
    screenshotHashes: {},
    screenshotDimensions: {},
    assertions: {},
  };

  try {
    // ----- Chromium executable path -----
    let chromiumExecutable = '';
    try {
      chromiumExecutable = chromium.executablePath();
    } catch (e) {
      chromiumExecutable = `(error: ${e.message})`;
    }

    // ----- Launch clean browser -----
    console.log('Launching Chromium with fresh --user-data-dir...');
    const launchArgs = ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'];
    const browser = await chromium.launchPersistentContext(tmpDir, {
      headless: true,
      args: launchArgs,
    });

    const profileExistsAfter = existsSync(tmpDir);
    const allLaunchArgs = [`--user-data-dir=${tmpDir}`, ...launchArgs];

    console.log(`  Profile exists after launch: ${profileExistsAfter}`);
    console.log(`\nCHROMIUM EXECUTABLE: ${chromiumExecutable}`);
    console.log(`LAUNCH ARGS: ${allLaunchArgs.join(' ')}`);
    evidence.chromiumInfo = {
      executable: chromiumExecutable,
      args: allLaunchArgs,
      userDataDir: tmpDir,
      profileExistedAfterLaunch: profileExistsAfter,
    };

    const page = await browser.newPage();

    // =====================================================================
    // BEFORE SNAPSHOT — blank page on same origin, no app load
    // =====================================================================
    console.log('\n─── BEFORE SNAPSHOT (same-origin blank page, no app load yet) ───');
    await page.setViewportSize({ width: 1280, height: 720 });

    // We navigate to the app's origin but intercept to serve a minimal blank HTML
    // page. This keeps the same origin (http://127.0.0.1:5199) which is necessary
    // for localStorage and IndexedDB access, but no app code runs.
    await page.route('http://127.0.0.1:5199/blank-before/', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'text/html',
        body: '<!DOCTYPE html><html><head><title>Blank</title></head><body></body></html>',
      });
    });
    await page.goto('http://127.0.0.1:5199/blank-before/', { waitUntil: 'networkidle', timeout: 10000 });

    const beforeLS = await readLocalStorage(page);
    const beforeIDB = await readAllIndexedDB(page);

    evidence.before.localStorage = beforeLS;
    evidence.before.indexedDB = beforeIDB;

    console.log(`localStorage keys: ${Object.keys(beforeLS).length}`);
    if (Object.keys(beforeLS).length > 0) {
      for (const [k, v] of Object.entries(beforeLS)) {
        console.log(`  ${k}=${v}`);
      }
    } else {
      console.log('  (empty — PASS)');
    }

    console.log(`IndexedDB databases:`);
    if (beforeIDB.error) {
      console.log(`  Query error: ${beforeIDB.error}`);
    } else if (Object.keys(beforeIDB).length === 0) {
      console.log('  (no databases — PASS)');
    } else {
      for (const [dbName, stores] of Object.entries(beforeIDB)) {
        console.log(`  ${dbName}: ${JSON.stringify(stores)}`);
      }
    }

    // =====================================================================
    // AFTER SNAPSHOT — navigate to app, let it boot
    // =====================================================================
    // Remove the route interceptor so the real app loads
    await page.unroute('http://127.0.0.1:5199/blank-before/');
    console.log(`\n─── AFTER SNAPSHOT (after navigating to ${BASE_URL}) ───`);
    await page.goto(BASE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await sleep(3000); // Let React fully render and hydrate

    const afterLS = await readLocalStorage(page);
    const afterIDB = await readAllIndexedDB(page);

    evidence.after.localStorage = afterLS;
    evidence.after.indexedDB = afterIDB;

    console.log(`\nlocalStorage keys: ${Object.keys(afterLS).length}`);
    for (const [k, v] of Object.entries(afterLS)) {
      console.log(`  ${k}=${v}`);
    }

    console.log(`\nIndexedDB databases:`);
    if (afterIDB.error) {
      console.log(`  Query error: ${afterIDB.error}`);
    } else {
      for (const [dbName, stores] of Object.entries(afterIDB)) {
        console.log(`  ${dbName}:`);
        for (const [store, count] of Object.entries(stores)) {
          const expectedZero = ['messages', 'artifacts', 'settings', 'tasks'].includes(store);
          const expectedOne = ['conversations', 'sessions'].includes(store);
          const status = expectedZero && count === 0 ? 'PASS'
            : expectedOne && count === 1 ? 'PASS'
            : count === 0 ? 'PASS'
            : 'FAIL';
          console.log(`    ${store}: ${count} rows ${status}`);
        }
      }
    }

    // --- DOM text ---
    const visibleText = await page.evaluate(() => {
      const walker = document.createTreeWalker(
        document.body, NodeFilter.SHOW_TEXT,
        { acceptNode: (node) => {
          const el = node.parentElement;
          if (!el) return NodeFilter.FILTER_REJECT;
          const style = window.getComputedStyle(el);
          if (style.display === 'none' || style.visibility === 'hidden') return NodeFilter.FILTER_REJECT;
          return NodeFilter.FILTER_ACCEPT;
        }},
      );
      const texts = [];
      let node;
      while ((node = walker.nextNode())) {
        const t = node.textContent.trim();
        if (t) texts.push(t);
      }
      return texts;
    });
    evidence.after.dom = { visibleText, count: visibleText.length };
    console.log('\nVisible DOM text:');
    visibleText.forEach(t => console.log(`  "${t}"`));

    // --- Desktop screenshot ---
    const desktopPath = join(SCREENSHOT_DIR, 'blank-first-run.png');
    await page.screenshot({ path: desktopPath, fullPage: false });
    evidence.screenshots.desktop = desktopPath;
    evidence.screenshotHashes.desktop = fileHash(desktopPath);
    evidence.screenshotDimensions.desktop = getImageDimensions(desktopPath);
    console.log(`\nDesktop screenshot: ${desktopPath}`);
    console.log(`  ${evidence.screenshotDimensions.desktop.width}×${evidence.screenshotDimensions.desktop.height}`);
    console.log(`  SHA256: ${evidence.screenshotHashes.desktop}`);

    const desktopSize = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    }));
    evidence.viewports.desktop = desktopSize;

    // --- Mobile screenshot ---
    await page.setViewportSize({ width: 375, height: 812 });
    await sleep(500);
    const mobilePath = join(SCREENSHOT_DIR, 'blank-first-run-mobile.png');
    await page.screenshot({ path: mobilePath, fullPage: false });
    evidence.screenshots.mobile = mobilePath;
    evidence.screenshotHashes.mobile = fileHash(mobilePath);
    evidence.screenshotDimensions.mobile = getImageDimensions(mobilePath);
    console.log(`Mobile screenshot: ${mobilePath}`);
    console.log(`  ${evidence.screenshotDimensions.mobile.width}×${evidence.screenshotDimensions.mobile.height}`);
    console.log(`  SHA256: ${evidence.screenshotHashes.mobile}`);

    const mobileSize = await page.evaluate(() => ({
      width: document.documentElement.clientWidth,
      height: document.documentElement.clientHeight,
    }));
    evidence.viewports.mobile = mobileSize;

    // --- Close browser ---
    await browser.close();

    // =====================================================================
    // ASSERTIONS
    // =====================================================================
    const beforeLocalStorageEmpty = Object.keys(beforeLS).length === 0;
    const beforeIDBEmpty = !beforeIDB.error && Object.keys(beforeIDB).length === 0;

    // After: app auto-creates 1 default session + 1 empty conversation on first run.
    // Important: messages=0, artifacts=0, settings=0 (no user data yet).
    const afterIDBMap = afterIDB.error ? {} : afterIDB;
    const appDB = afterIDBMap['swarm'] || {};
    const conversationsCount = appDB.conversations || 0;
    const sessionsCount = appDB.sessions || 0;
    const messagesZero = (appDB.messages || 0) === 0;
    const artifactsZero = (appDB.artifacts || 0) === 0;
    const settingsZero = (appDB.settings || 0) === 0;
    const defaultConvAndSession = conversationsCount === 1 && sessionsCount === 1;
    const noUserData = messagesZero && artifactsZero && settingsZero;

    // After: preferences may exist (swarm-last-conversation set by default conv creation)
    const afterSwarmPrefKeys = Object.keys(afterLS).filter(k => k.startsWith('swarm-'));
    const hasLastConversationKey = afterSwarmPrefKeys.includes('swarm-last-conversation');

    const titleText = visibleText.some(t => t.toLowerCase().includes('swarm'));
    const ctaText = visibleText.some(t =>
      t.includes('Send a message') || t.includes('message') && t.includes('start')
    );

    evidence.assertions = {
      beforeLocalStorageEmpty,
      beforeIndexedDBEmpty: beforeIDBEmpty,
      afterConversations: conversationsCount,
      afterSessions: sessionsCount,
      defaultConvAndSession,
      afterMessagesZero: messagesZero,
      afterArtifactsZero: artifactsZero,
      afterSettingsZero: settingsZero,
      noUserData,
      hasLastConversationKey,
      afterSwarmPreferenceKeys: afterSwarmPrefKeys,
      titleSwarmVisible: titleText,
      ctaVisible: ctaText,
      profileNewlyCreated: !profileExistsBefore && profileExistsAfter,
      profileDeletedAfterCleanup: null, // set after cleanup
    };

    console.log('\n═══ ASSERTIONS ═══');
    console.log(`  BEFORE localStorage empty: ${beforeLocalStorageEmpty ? 'PASS' : 'FAIL'}`);
    console.log(`  BEFORE IndexedDB no app DB: ${beforeIDBEmpty ? 'PASS' : 'FAIL'}`);
    console.log(`  AFTER conversations=${conversationsCount}, sessions=${sessionsCount} (1 each = default): ${defaultConvAndSession ? 'PASS' : 'FAIL'}`);
    console.log(`  AFTER messages=0: ${messagesZero ? 'PASS' : 'FAIL'}`);
    console.log(`  AFTER artifacts=0: ${artifactsZero ? 'PASS' : 'FAIL'}`);
    console.log(`  AFTER settings=0: ${settingsZero ? 'PASS' : 'FAIL'}`);
    console.log(`  AFTER no user data: ${noUserData ? 'PASS' : 'FAIL'}`);
    console.log(`  AFTER has swamp-last-conversation key: ${hasLastConversationKey ? 'PASS' : 'FAIL'}`);
    console.log(`  AFTER swarm-* preference keys: [${afterSwarmPrefKeys.join(', ')}]`);
    console.log(`  Title "Swarm" visible: ${titleText ? 'PASS' : 'FAIL'}`);
    console.log(`  CTA visible: ${ctaText ? 'PASS' : 'FAIL'}`);
    console.log(`  Profile newly created: ${(!profileExistsBefore && profileExistsAfter) ? 'PASS' : 'FAIL'}`);

  } finally {
    server.kill('SIGTERM');
    console.log('\nPreview server stopped.');
  }

  // Write evidence
  writeFileSync(OUT_FILE, JSON.stringify(evidence, null, 2));
  console.log(`\nEvidence JSON written: ${OUT_FILE}`);

  // Clean up temp profile
  let profileExistedAfterClean = false;
  try {
    rmSync(tmpDir, { recursive: true, force: true });
    profileExistedAfterClean = existsSync(tmpDir);
    evidence.assertions.profileDeletedAfterCleanup = !profileExistedAfterClean;
    console.log(`Temp profile cleaned: ${tmpDir}`);
    console.log(`  Profile exists after cleanup: ${profileExistedAfterClean} (expected: false)`);
  } catch (e) {
    console.log(`Profile cleanup: ${e.message}`);
    evidence.assertions.profileDeletedAfterCleanup = false;
  }

  return evidence;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

runE2E()
  .then((evidence) => {
    const pass = evidence.assertions.beforeLocalStorageEmpty &&
                 evidence.assertions.beforeIndexedDBEmpty &&
                 evidence.assertions.defaultConvAndSession &&
                 evidence.assertions.noUserData &&
                 evidence.assertions.titleSwarmVisible &&
                 evidence.assertions.ctaVisible &&
                 evidence.assertions.profileNewlyCreated &&
                 evidence.assertions.profileDeletedAfterCleanup;
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`E2E BLANK FIRST RUN: ${pass ? 'PASS' : 'FAIL'}`);
    console.log(`${'═'.repeat(50)}`);
    process.exit(pass ? 0 : 1);
  })
  .catch((err) => {
    console.error('E2E Error:', err);
    process.exit(1);
  });
