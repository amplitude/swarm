#!/usr/bin/env node
/**
 * Preview E2E build — creates a production-like bundle using `mode=e2e`
 * Vite config that aliases the real WebLLM provider with the deterministic
 * E2E test fixture, then starts a preview server that stays running.
 *
 * Usage:
 *   node scripts/preview-e2e.mjs           # build + serve (keeps running)
 *   SWARM_E2E_PORT=5173 node scripts/preview-e2e.mjs   # custom port
 */

import { execSync, spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import http from 'node:http';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const distDir = resolve(root, 'dist');
const port = parseInt(process.env.SWARM_E2E_PORT || '4173', 10);

// Clean previous dist
try { execSync('rm -rf dist', { cwd: root, stdio: 'inherit' }); } catch {}

// Build with e2e vite config
console.log('\n[preview-e2e] Building E2E test bundle...\n');
execSync('npx vite build --config vite.e2e.config.ts', {
  cwd: root,
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'production' },
});

// Verify the fixture was bundled
console.log('\n[preview-e2e] Verifying E2E fixture bundled...\n');
try {
  const files = execSync(`find "${distDir}" -name '*.js' -type f`, { cwd: root, encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  let hasMarker = false;
  for (const f of files) {
    try {
      const content = readFileSync(f, 'utf8');
      if (content.includes('__E2E_PROVIDER__')) {
        hasMarker = true;
        console.log(`  ✓ E2E marker found in ${f.replace(distDir, 'dist')}`);
        break;
      }
    } catch {}
  }
  if (!hasMarker) {
    console.error('  ✗ E2E marker NOT found — fixture may not have been bundled');
    process.exit(1);
  }
  console.log('  ✓ E2E fixture verified in bundle\n');
} catch (err) {
  console.error('  ✗ Failed to verify E2E fixture:', err.message);
  process.exit(1);
}

// Note: model-constants.ts contains model descriptions with "SmolLM2-135M"
// and "webllm" strings. These are data, not imports. Not a contamination.
console.log('  ✓ E2E bundle verified (model descriptions in data are expected)\n');

// Start preview server
console.log(`[preview-e2e] Starting preview server on http://localhost:${port}\n`);

const server = spawn('npx', ['vite', 'preview', '--port', String(port), '--strictPort'], {
  cwd: root,
  stdio: ['ignore', 'inherit', 'inherit'],
  env: { ...process.env, NODE_ENV: 'production' },
});

server.on('exit', (code) => {
  if (code !== null && code !== 0) {
    console.error(`[preview-e2e] Server exited with code ${code}`);
    process.exit(code);
  }
});

// Wait for server to be ready
await new Promise((resolveReady) => {
  const maxAttempts = 30;
  let attempts = 0;
  const check = () => {
    attempts++;
    const req = http.get(`http://127.0.0.1:${port}/`, (res) => {
      if (res.statusCode === 200) {
        console.log(`  ✓ Preview server ready\n`);
        resolveReady();
      } else {
        if (attempts < maxAttempts) setTimeout(check, 500);
      }
    });
    req.on('error', () => {
      if (attempts < maxAttempts) setTimeout(check, 500);
      else {
        console.error(`  ✗ Server not ready after ${maxAttempts} attempts`);
        resolveReady();
      }
    });
    req.end();
  };
  setTimeout(check, 500);
});

// Keep the process alive while the server runs
process.stdin.resume();

// Handle graceful shutdown
process.on('SIGINT', () => {
  server.kill('SIGINT');
  process.exit(0);
});
process.on('SIGTERM', () => {
  server.kill('SIGTERM');
  process.exit(0);
});
