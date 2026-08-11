#!/usr/bin/env node
/**
 * Bundle assertion — scans the production build output to verify that:
 * 1. The real WebLLM provider is bundled (not the E2E fixture)
 * 2. No E2E fixture markers exist
 * 3. No Demo/Ollama/test-provider/synthetic paths exist
 *
 * Usage:
 *   node scripts/assert-bundle.mjs        # assumes dist/
 *   SWARM_DIST=path node scripts/assert-bundle.mjs
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

const distDir = resolve(process.env.SWARM_DIST || 'dist');

if (!existsSync(distDir)) {
  console.error(`  ✗ dist directory not found at ${distDir}`);
  console.error('  Run "pnpm build" first');
  process.exit(1);
}

const files = execSync(`find "${distDir}" -type f`, { encoding: 'utf8' })
  .trim().split('\n').filter(Boolean);

console.log(`Bundle assertion: scanning ${files.length} files in ${distDir}\n`);

// Only check text files for content
const textFiles = files.filter((f) => f.endsWith('.js') || f.endsWith('.html'));

// ── Patterns that MUST NOT appear in production bundle ─────────────────────
const FORBIDDEN = [
  '__E2E_PROVIDER__',
  'E2E provider',
  'e2e-provider',
  'e2e load:',
  'TestProvider',
  'DemoProvider',
  'Demo mode',
  'Ollama',
  'test-provider',
  'This is a test response',
  'canned response',
  'synthetic assistant',
  'Test mode',
];

// ── Patterns that MUST appear (real WebLLM is bundled) ─────────────────────
const REQUIRED = [
  'WebLLM',
  '@mlc-ai/web-llm',
  'SmolLM2',
  'CreateMLCEngine',
  'initProgressCallback',
  'WebGPU',
];

let violations = 0;
let satisfied = 0;

console.log('── Forbidden patterns (must be absent) ──');
for (const pattern of FORBIDDEN) {
  let found = false;
  for (const f of textFiles) {
    try {
      const content = readFileSync(f, 'utf8');
      if (content.includes(pattern)) {
        const rel = f.replace(distDir, 'dist');
        console.log(`  ✗ "${pattern}" found in ${rel}`);
        found = true;
        violations++;
        break;
      }
    } catch {}
  }
  if (!found) {
    console.log(`  ✓ "${pattern}" absent`);
    satisfied++;
  }
}

console.log('\n── Required patterns (must be present) ──');
for (const pattern of REQUIRED) {
  let found = false;
  for (const f of textFiles) {
    try {
      const content = readFileSync(f, 'utf8');
      if (content.includes(pattern)) {
        found = true;
        break;
      }
    } catch {}
  }
  if (found) {
    console.log(`  ✓ "${pattern}" found`);
    satisfied++;
  } else {
    console.log(`  ✗ "${pattern}" NOT found`);
    violations++;
  }
}

// Summary
console.log(`\n══ Results: ${satisfied} passed, ${violations} violations`);
if (violations > 0) {
  console.error('  ✗ Bundle assertion FAILED');
  process.exit(1);
} else {
  console.log('  ✓ Bundle assertion PASSED');
}
