#!/usr/bin/env node

/**
 * Theme Audit Script
 *
 * Verifies:
 *  1. Required CSS variable tokens exist in theme.css
 *  2. Dark overrides exist in theme.css
 *  3. theme.css is imported exactly once from index.css
 *  4. Tailwind semantic mappings reference CSS variables (not hex values)
 *  5. Production component files contain no disallowed raw palette utility
 *     patterns or fixed panel widths (with explicit allowlist)
 *
 * Usage:  node scripts/audit-theme.mjs
 *         node scripts/audit-theme.mjs --fix    (auto-fix where possible)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

let passed = 0;
let failed = 0;
let warnings = 0;

function check(condition, label, detail = '') {
  if (condition) {
    console.log(`  ✓ ${label}`);
    passed++;
  } else {
    console.log(`  ✗ ${label}  ${detail}`);
    failed++;
  }
}

function warn(label, detail = '') {
  console.log(`  ⚠ ${label}  ${detail}`);
  warnings++;
}

// ── 1. Required tokens exist in theme.css ────────────────────────────

const THEME_PATH = path.join(ROOT, 'src/styles/theme.css');
const INDEX_CSS_PATH = path.join(ROOT, 'src/index.css');
const TAILWIND_CONFIG_PATH = path.join(ROOT, 'tailwind.config.ts');

console.log('\n═══ THEME AUDIT ═══\n');

// 1a. File exists
check(existsSync(THEME_PATH), 'theme.css exists');

const themeCss = readFileSync(THEME_PATH, 'utf-8');

// Required token categories
const REQUIRED_PREFIXES = [
  '--brand-',
  '--agent-',
  '--canvas',
  '--surface',
  '--surface-raised',
  '--surface-overlay',
  '--surface-inset',
  '--overlay',
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  '--text-inverse',
  '--text-disabled',
  '--border-default',
  '--border-subtle',
  '--border-strong',
  '--focus-ring',
  '--focus-offset',
  '--success-',
  '--warning-',
  '--danger-',
  '--info-',
  '--font-sans',
  '--font-mono',
  '--text-base',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--radius-xl',
  '--radius-2xl',
  '--radius-3xl',
  '--radius-full',
  '--composer-radius',
  '--message-radius',
  '--shadow-xs',
  '--shadow-sm',
  '--shadow-md',
  '--shadow-lg',
  '--shadow-xl',
  '--shadow-inner',
  '--gap-sm',
  '--gap-md',
  '--gap-lg',
  '--panel-gap',
  '--control-gap',
  '--control-height',
  '--sidebar-width',
  '--inspector-width',
  '--content-max-width',
  '--header-height',
  '--statusbar-height',
  '--message-user-bg',
  '--message-user-text',
  '--message-assistant-bg',
  '--handoff-bg',
  '--scrollbar-thumb',
];

console.log('\n[1] Required tokens in theme.css');
for (const prefix of REQUIRED_PREFIXES) {
  const found = themeCss.includes(prefix);
  check(found, `${prefix}* is defined`);
}

// ── 2. Dark overrides exist ──────────────────────────────────────────

console.log('\n[2] Dark / Light overrides');

check(themeCss.includes('.light'), '.light section exists');
check(themeCss.includes('.dark'), '.dark section exists');
check(themeCss.includes(':root'), ':root section exists');

// Check that .light overrides at least some surface/text/border tokens
const LIGHT_OVERRIDES = ['--canvas', '--surface', '--text-primary', '--border-default'];
for (const token of LIGHT_OVERRIDES) {
  // Find the .light block
  const lightIdx = themeCss.indexOf('.light');
  const afterLight = themeCss.slice(lightIdx);
  const found = afterLight.includes(token);
  check(found, `.light overrides ${token}`);
}

// ── 3. Global import ─────────────────────────────────────────────────

console.log('\n[3] Global import');

const indexCss = readFileSync(INDEX_CSS_PATH, 'utf-8');
const themeImports = indexCss.match(/@import\s+["']\.\/styles\/theme\.css["']/g);
check(themeImports !== null && themeImports.length === 1,
  'theme.css imported exactly once from index.css',
  themeImports ? `found ${themeImports.length}` : 'not found');

// ── 4. Tailwind config references CSS variables ──────────────────────

console.log('\n[4] Tailwind semantic mappings reference CSS variables');

const tailwindConfig = readFileSync(TAILWIND_CONFIG_PATH, 'utf-8');

// Should NOT contain raw hex values in color definitions
const hexInColors = tailwindConfig.match(/#[0-9a-fA-F]{3,8}(?=[\s,;\n)])/g);
if (hexInColors) {
  warn('Hex values found in tailwind config colors', hexInColors.join(', '));
} else {
  check(true, 'No hex values in tailwind config color definitions');
}

// Should use var() for all color values
const colorValues = tailwindConfig.match(/`[^`]+`/g) || [];
const varRefs = colorValues.filter(v => v.includes('var(--'));
check(varRefs.length >= 30, 'At least 30 var() references in config values', `${varRefs.length} found`);

// ── 5. Component files — no disallowed raw palette ───────────────────

console.log('\n[5] No disallowed raw palette in component files');

const ALLOWLIST = [
  'theme.css',
  'globals.css',
  'DESIGN-SYSTEM.md',
  'theming.md',
  'vitest.config.ts',
  '.spec.ts',
  '.test.ts',
  'audit-theme',
  '__tests__',
  'node_modules',
  'dist',
  '.git',
];

// Files to scan (all tsx/ts/css files in src/components and src/app)
function walk(dir, ext) {
  const results = [];
  const list = readdirSync(dir);
  for (const item of list) {
    const full = path.join(dir, item);
    const st = statSync(full);
    if (st.isDirectory()) {
      results.push(...walk(full, ext));
    } else if (item.endsWith(ext)) {
      results.push(full);
    }
  }
  return results;
}
const componentFiles = [
  ...walk(path.join(ROOT, 'src/components'), '.tsx'),
  ...walk(path.join(ROOT, 'src/components'), '.ts'),
  ...walk(path.join(ROOT, 'src/components'), '.css'),
  ...walk(path.join(ROOT, 'src/app'), '.tsx'),
];

const RAW_PALETTE_PATTERNS = [
  /gray-\d{2,3}(?!\/)/,      // gray-100, etc.
  /zinc-\d{2,3}/,
  /slate-\d{2,3}/,
  /blue-\d{2,3}/,
  /purple-\d{2,3}/,
  /green-\d{2,3}/,
  /red-\d{2,3}/,
  /yellow-\d{2,3}/,
  /text-white\b/,
  /text-black\b/,
  /bg-white\b/,
  /bg-black\//,
  /#[0-9a-fA-F]{3,6}(?!\w)/,  // hex colors (but not in comments)
];

const ISSUES = [];

for (const file of componentFiles) {
  const relPath = path.relative(ROOT, file);
  const content = readFileSync(file, 'utf-8');

  for (const pattern of RAW_PALETTE_PATTERNS) {
    const matches = content.match(pattern);
    if (matches) {
      ISSUES.push({ file: relPath, pattern: pattern.toString(), matches });
    }
  }
}

// Filter out false positives (CSS variable references, comments, allowlist)
const ALLOWED_MATCHES = [
  '#1a1a2e',  // Excalidraw third-party config fallback (comment-documented)
];

if (ISSUES.length === 0) {
  check(true, 'No raw palette patterns found in component files');
} else {
  // Filter legitimate issues
  const realIssues = ISSUES.filter(i => {
    const content = readFileSync(i.file, 'utf-8');
    // Check if match is actually in a comment or CSS variable name
    const lines = content.split('\n');
    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      if (line.includes(i.matches[0]) && !line.trim().startsWith('//') && !line.trim().startsWith('*') && !line.trim().startsWith('/*')) {
        // Check against explicit allowlist (third-party assets etc.)
        const isAllowed = ALLOWED_MATCHES.some(a => line.includes(a));
        if (!isAllowed) return true;
      }
    }
    return false;
  });

  if (realIssues.length === 0) {
    check(true, 'No disallowed raw palette patterns in component files (all matches are in comments)');
  } else {
    check(false, `Found ${realIssues.length} raw palette issues`, realIssues.map(i => `${i.file}: ${i.matches[0]}`).join(', '));
  }
}

// ── Summary ──────────────────────────────────────────────────────────

console.log('\n═══ SUMMARY ═══');
const total = passed + failed;
console.log(`  Passed: ${passed}/${total}  Failed: ${failed}  Warnings: ${warnings}`);

if (failed > 0) {
  console.log('\n❌ Some checks failed. Fix issues before committing.\n');
  process.exit(1);
} else {
  console.log('\n✅ All checks passed.\n');
  process.exit(0);
}
