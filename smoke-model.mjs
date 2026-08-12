#!/usr/bin/env node
/**
 * smoke-model.mjs — Real-model HTTP smoke test
 *
 * Requires a running server with a real model (no SWARM_FAKE).
 * Sends `foo` 5×, canary→foo, and concurrent requests, then verifies:
 *   - No inspection marker/raw JSON in responses
 *   - No prior canary bleed into a subsequent request
 *   - Concurrent requests all return safely
 *
 * Usage:
 *   node smoke-model.mjs [url]
 *     url defaults to http://localhost:4173
 *
 * Excluded from normal CI (not in playwright.config.js or ci.yml).
 * Run manually to verify a real model deployment.
 */

const BASE = process.argv[2] || 'http://localhost:4173';
const ENDPOINT = `${BASE}/api/chat`;

async function chat(message, sessionId) {
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message,
      userId: 'smoke-test',
      sessionId: sessionId || `smoke-session-${Date.now()}`,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return await res.json();
}

function sanitize(text) {
  // Replace non-ASCII/gibberish model names with a clean label
  return (text || '').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

async function main() {
  console.log(`\n=== REAL-MODEL SMOKE TEST ===`);
  console.log(`Server: ${BASE}\n`);

  let passed = 0;
  let failed = 0;

  function check(label, condition, detail) {
    if (condition) {
      console.log(`  ✅ ${label}`);
      passed++;
    } else {
      console.log(`  ❌ ${label}: ${detail || 'FAIL'}`);
      failed++;
    }
  }

  // ─── TEST 1-5: Five requests with "foo" ────────────────────────────
  console.log('─── TEST 1-5: Five requests with "foo" ───');
  const fooResults = [];
  for (let i = 0; i < 5; i++) {
    const result = await chat('foo');
    fooResults.push(result);
    const cleaned = sanitize(result.response);
    check(
      `[${i + 1}] foo → finishReason=${result.finishReason}`,
      result.finishReason === 'stop' || result.finishReason === 'fallback',
      `finishReason=${result.finishReason}`,
    );
    check(
      `[${i + 1}] no inspection marker`,
      !cleaned.includes('[Inspection') && !cleaned.includes('[Inspection of user message'),
      'Contains inspection marker',
    );
    check(
      `[${i + 1}] no raw JSON`,
      !cleaned.includes('wordCount') && !cleaned.includes('messageLength'),
      'Contains raw JSON',
    );
    console.log(`    response: ${cleaned.slice(0, 120)}`);
  }

  // ─── TEST 6: Canary then foo isolation ─────────────────────────────
  console.log('\n─── TEST 6: Canary then foo isolation ───');
  const canaryId = `canary-session-${Date.now()}`;
  const canary = await chat("I love turtles and I'm looking for advice.", canaryId);
  console.log(`    canary response: ${sanitize(canary.response).slice(0, 120)}`);
  const fooAfterCanary = await chat('foo', canaryId);
  const fooCleaned = sanitize(fooAfterCanary.response);
  console.log(`    foo after canary: ${fooCleaned.slice(0, 120)}`);
  check(
    'foo after canary is isolated (no turtle bleed)',
    !fooCleaned.toLowerCase().includes('turtle') || fooCleaned.toLowerCase().includes('sorry'),
    'Canary concept leaked into foo response',
  );

  // ─── TEST 7: Concurrent requests (3 simultaneous) ──────────────────
  console.log('\n─── TEST 7: Concurrent requests (3 simultaneous) ───');
  const concurrencyResults = await Promise.all([
    chat('concurrent-A', `conc-session-${Date.now()}-A`),
    chat('concurrent-B', `conc-session-${Date.now()}-B`),
    chat('concurrent-C', `conc-session-${Date.now()}-C`),
  ]);
  for (let i = 0; i < concurrencyResults.length; i++) {
    const r = concurrencyResults[i];
    const label = ['A', 'B', 'C'][i];
    check(
      `concurrent-${label} finishes (${r.finishReason})`,
      !!r.finishReason,
      `No finishReason for concurrent-${label}`,
    );
    const resp = sanitize(r.response);
    check(
      `concurrent-${label} no cross-talk`,
      !resp.includes('concurrent-A') || label === 'A',
      `Response contains other request's text`,
    );
    console.log(`    concurrent-${label}: ${resp.slice(0, 120)}`);
  }

  // ─── SUMMARY ───────────────────────────────────────────────────────
  const total = passed + failed;
  console.log(`\n─── RESULTS ───`);
  console.log(`  Passed: ${passed}/${total}`);
  if (failed > 0) {
    console.log(`  Failed: ${failed}/${total}`);
    process.exit(1);
  } else {
    console.log('  All checks passed ✅');
  }
}

main().catch((err) => {
  console.error('SMOKE TEST CRASHED:', err.message);
  process.exit(1);
});
