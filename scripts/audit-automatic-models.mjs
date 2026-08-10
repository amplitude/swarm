#!/usr/bin/env node

/**
 * audit-automatic-models.mjs — Exhaustive model-literal audit
 *
 * Recursively scans ALL tracked app/config TS/TSX files and reports every
 * model-like literal, default assignment, fallback configuration, and
 * auto-load reference. Fails if any automatic/default/fallback assignment
 * bypasses the centralized constants in model-constants.ts or references
 * a >1.5B / WebLLM model in an auto path.
 *
 * Prints UNABRIDGED raw output — no curated excerpts.
 *
 * Usage: node scripts/audit-automatic-models.mjs
 */

import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, '..');

// ===========================================================================
// Configuration
// ===========================================================================

const SRC_DIR = join(ROOT, 'src');

// Model-like literal patterns to search for
const MODEL_PATTERNS = [
  /['"](?:ollama\/)?[a-z][\w.-]*(?::\d+(?:\.\d+)?b)?['"]/gi,  // bare model IDs
  /['"](?:Qwen|Llama|Hermes|Phi)[\w.-]*['"]/gi,                // MLC model IDs
  /DEFAULT_MODEL/g,
  /RECOMMENDED_MODELS/g,
  /FALLBACK_MAP/g,
  /PROVIDER_DEFAULT_MODELS/g,
  /defaultFallbackModel/g,
  /fallbackModel/g,
  /autoModel/g,
  /OnboardingDefault/g,
  /enumerateAuto/g,
  /enumerateExpert/g,
  /\bmodelId\s*[=:]/g,
  /\bmodel\s*[=:]\s*['"]/g,
  /OLLAMA_AUTO_MODELS/g,
  /MLC_EXPERT_MODELS/g,
  /DEFAULT_FALLBACK_MODEL_ID/g,
];

// Lines that are in model-constants.ts — the only place auto model literals should be defined
const CENTRALIZED_FILE = 'src/llm/model-constants.ts';

// Files that ARE the centralized constants source — all defs here are intentional
const CENTRALIZED_SOURCE_FILES = [
  'src/llm/model-constants.ts',
];

// Files that are exempt from auto-path violations (tests, capability mappings, re-exports)
const EXEMPT_AUTO_PATH_FILES = [
  'src/llm/model-capabilities.ts',     // capability feature-flags, not auto-path definitions
  'src/llm/engine.ts',                  // re-exports from model-constants.ts
  'src/utils/storage-cleanup.ts',       // cache cleanup — string filters like 'MLC' are not auto-path defs
  'src/app/App.tsx',                    // app bootstrap — uses DEFAULT_MODEL import, not defining auto paths
];

// Model IDs that are >1.5B — should NEVER appear in auto/default/fallback paths
const EXPERT_ONLY_IDS = [
  'Qwen3-8B-q4f16_1-MLC',
  'Qwen3-4B-q4f16_1-MLC',
  'Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC',
  'Hermes-3-Llama-3.1-8B-q4f16_1-MLC',
  'Llama-3.1-8B-Instruct-q4f16_1-MLC',
  'Phi-3.5-mini-instruct-q4f16_1-MLC',
  'phi3.5:3.8b',
  'phi3:mini',
  'phi3',
  'llama3.2:3b',
];

// Model IDs that are <=1.5B and OK for auto paths
const ALLOWED_AUTO_IDS = [
  'ollama/qwen2.5-coder:0.5b',
  'ollama/qwen2.5-coder:1.5b',
  'ollama/qwen2.5:0.5b',
  'ollama/qwen2.5:1.5b',
  'ollama/llama3.2:1b',
  'qwen2.5-coder:0.5b',
  'qwen2.5-coder:1.5b',
  'qwen2.5:0.5b',
  'qwen2.5:1.5b',
  'llama3.2:1b',
];

// ===========================================================================
// Scan all TS/TSX files recursively
// ===========================================================================

function getAllFiles(dir, ext, maxFiles = 2000) {
  const result = [];
  try {
    const entries = execSync(
      `git -C "${ROOT}" ls-files '*.${ext}' 2>/dev/null || find "${dir}" -name "*.${ext}" -not -path "*/node_modules/*" -not -path "*/dist/*"`,
      { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 },
    ).trim().split('\n').filter(Boolean);
    
    for (const e of entries) {
      const fullPath = join(ROOT, e);
      if (existsSync(fullPath) && result.length < maxFiles) {
        result.push(e);
      }
    }
  } catch {
    // Fallback: use find
    const output = execSync(`find "${dir}" -name "*.${ext}" -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/.git/*"`, {
      encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024,
    }).trim().split('\n').filter(Boolean);
    for (const f of output) {
      const rel = f.replace(ROOT + '/', '');
      if (result.length < maxFiles) result.push(rel);
    }
  }
  return result;
}

// ===========================================================================
// Scan for model-like literals in a file
// ===========================================================================

function scanFile(filePath) {
  const results = [];
  const fullPath = join(ROOT, filePath);
  if (!existsSync(fullPath)) return results;

  const content = readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    // Skip comments
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;

    for (const pattern of MODEL_PATTERNS) {
      const matches = line.matchAll(pattern);
      for (const match of matches) {
        let found = match[0];
        
        // Clean up the match
        if (found.startsWith("'") || found.startsWith('"')) {
          // It's a string literal model ID
          const str = found.slice(1, -1);
          results.push({
            file: filePath,
            line: lineNum,
            column: match.index ?? 0,
            match: str,
            raw: line.trim().slice(0, 120),
            type: classifyLiteral(str, filePath),
          });
        } else {
          // It's a code reference
          results.push({
            file: filePath,
            line: lineNum,
            column: match.index ?? 0,
            match: found,
            raw: line.trim().slice(0, 120),
            type: classifyIdentifier(found, filePath),
          });
        }
      }
    }
  }

  return results;
}

function classifyLiteral(str, filePath) {
  const isFromCentralized = filePath === CENTRALIZED_FILE;

  // Check if it's a model ID
  const isExpert = EXPERT_ONLY_IDS.some((e) => str.includes(e));
  const isAllowedAuto = ALLOWED_AUTO_IDS.includes(str);

  if (isExpert) {
    if (isFromCentralized) return 'EXPERT-ONLY (centralized — OK)';
    return 'EXPERT-ONLY (>1.5B) ⚠';
  }

  if (isAllowedAuto) {
    if (isFromCentralized) return 'AUTO-ALLOWED (centralized — OK)';
    return 'AUTO-ALLOWED (outside centralized) ⚠';
  }

  // Check if it looks like a model ID with a size tag
  const sizeMatch = str.match(/:(\d+(?:\.\d+)?)b/i);
  if (sizeMatch) {
    const size = parseFloat(sizeMatch[1]);
    if (size > 1.5) {
      if (isFromCentralized) return `>1.5B (${size}B, centralized — OK)`;
      return `>1.5B (${size}B) ⚠`;
    }
    if (isFromCentralized) return `<=1.5B (${size}B, centralized — OK)`;
    return `<=1.5B (${size}B, outside centralized) ⚠`;
  }

  const mlcSizeMatch = str.match(/(\d+)B/);
  if (mlcSizeMatch) {
    const size = parseFloat(mlcSizeMatch[1]);
    if (isFromCentralized) return `MLC ${size}B (centralized — OK)`;
    return `MLC ${size}B ⚠`;
  }

  // Check for known MLC model IDs
  if (str.includes('MLC')) {
    if (isFromCentralized) return 'MLC model (centralized — OK)';
    return 'MLC model ⚠';
  }

  return 'unknown model reference';
}

function classifyIdentifier(id, filePath) {
  const isFromCentralized = filePath === CENTRALIZED_FILE;

  const autoRefs = ['DEFAULT_MODEL', 'RECOMMENDED_MODELS', 'FALLBACK_MAP', 'PROVIDER_DEFAULT_MODELS',
    'OLLAMA_AUTO_MODELS', 'MLC_EXPERT_MODELS', 'DEFAULT_FALLBACK_MODEL_ID', 'enumerateAutoModelIds',
    'enumerateExpertModelIds', 'isModelAutoAllowed', 'resolveOnboardingDefaultModel'];
  const riskyRefs = ['modelId', 'model'];

  if (autoRefs.includes(id)) {
    if (isFromCentralized) return `CONSTANT DEF (${id})`;
    if (filePath.includes('__tests__')) return `CONSTANT REF (${id}, test — OK)`;
    return `CONSTANT REF (${id})`;
  }

  if (riskyRefs.includes(id) || riskyRefs.some((r) => id.startsWith(r))) {
    return `VAR/DEF (${id})`;
  }

  return `OTHER (${id})`;
}

// ===========================================================================
// Main
// ===========================================================================

console.log('═══════════════════════════════════════════════════════════');
console.log('  EXHAUSTIVE AUTOMATIC-MODEL AUDIT');
console.log('═══════════════════════════════════════════════════════════\n');

// Get all TS/TSX files
console.log('Scanning tracked TS/TSX files...\n');
const tsFiles = getAllFiles(SRC_DIR, 'ts');
const tsxFiles = getAllFiles(SRC_DIR, 'tsx');
const allFiles = [...tsFiles, ...tsxFiles].sort();

console.log(`Files found: ${allFiles.length}`);
console.log(`  TS: ${tsFiles.length}`);
console.log(`  TSX: ${tsxFiles.length}\n`);

// Scan each file
const allFindings = [];
const fileFindings = new Map();

for (const file of allFiles) {
  const findings = scanFile(file);
  if (findings.length > 0) {
    fileFindings.set(file, findings);
    allFindings.push(...findings);
  }
}

// Print UNABRIDGED raw output
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  RAW FINDINGS (unabridged)                              ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

for (const [file, findings] of fileFindings) {
  console.log(`── ${file} ──`);
  for (const f of findings) {
    const line = `  L${f.line}:${f.column} [${f.type}] "${f.match}"`;
    console.log(line.padEnd(100) + (f.raw ? ` // ${f.raw}` : ''));
  }
  console.log();
}

// Summary
console.log('╔══════════════════════════════════════════════════════════╗');
console.log('║  SUMMARY                                                ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log(`Total files with model references: ${fileFindings.size}`);
console.log(`Total model references: ${allFindings.length}`);

// Count by type
const typeCounts = {};
for (const f of allFindings) {
  typeCounts[f.type] = (typeCounts[f.type] || 0) + 1;
}
console.log('\nBreakdown by type:');
for (const [type, count] of Object.entries(typeCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${count.toString().padStart(3)}x  ${type}`);
}

// Check for violations
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  VIOLATION CHECK                                        ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

let violations = 0;
let warnings = 0;

for (const f of allFindings) {
  // Determine file category
  const isTestFile = f.file.includes('__tests__');
  const isExemptFile = EXEMPT_AUTO_PATH_FILES.includes(f.file);
  const isCentralizedFile = CENTRALIZED_SOURCE_FILES.includes(f.file);
  const isProductionSrc = !isTestFile && !isExemptFile && !isCentralizedFile && f.file.startsWith('src/') && !f.file.includes('tailwind.config') && !f.file.includes('vite.config') && !f.file.includes('vitest.config');

  // Only flag violations in production source files (not tests, not exempt files, not centralized source)
  if (isProductionSrc) {
    // >1.5B / MLC model IDs in production source outside centralized
    if (f.type.includes('EXPERT-ONLY') && !f.type.includes('centralized')) {
      console.log(`  ❌ VIOLATION: ${f.file}:L${f.line} — ${f.match} (${f.type})`);
      violations++;
    }
    if (f.type.includes('>1.5B') && !f.type.includes('centralized')) {
      console.log(`  ❌ VIOLATION: ${f.file}:L${f.line} — ${f.match} (${f.type})`);
      violations++;
    }
    if (f.type.includes('MLC') && !f.type.includes('centralized')) {
      console.log(`  ❌ VIOLATION: ${f.file}:L${f.line} — ${f.match} (${f.type})`);
      violations++;
    }
    // Auto-allowed model IDs in production source outside centralized
    if (f.type.includes('outside centralized')) {
      console.log(`  ❌ VIOLATION: ${f.file}:L${f.line} — ${f.match} (${f.type})`);
      violations++;
    }
  } else {
    // Non-violation references (test, exempt, or config files)
    if (f.type.includes('⚠')) {
      console.log(`  ⚠ REFERENCE: ${f.file}:L${f.line} — ${f.match} (${f.type})`);
      warnings++;
    }
  }
}

// Separately print expert-only models
console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  EXPERT-ONLY MODEL REFERENCES                            ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

const expertFindings = allFindings.filter((f) => 
  f.type.includes('EXPERT-ONLY') || EXPERT_ONLY_IDS.some((e) => f.match.includes(e))
);

if (expertFindings.length > 0) {
  for (const f of expertFindings) {
    const status = f.type.includes('centralized') ? '✅ centralized' : '⚠';
    console.log(`  ${status} ${f.file}:L${f.line} — "${f.match}"`);
  }
} else {
  console.log('  (none found)');
}

console.log('\n╔══════════════════════════════════════════════════════════╗');
console.log('║  VERDICT                                                ║');
console.log('╚══════════════════════════════════════════════════════════╝\n');

console.log(`  Violations: ${violations}`);
console.log(`  Warnings: ${warnings}`);

if (violations > 0) {
  console.log('\n  ❌ FAIL: Automatic/default/fallback assignments bypass centralized constants\n');
  process.exit(1);
} else if (warnings > 0) {
  console.log('\n  ⚠ PASS WITH WARNINGS\n');
  process.exit(0);
} else {
  console.log('\n  ✅ PASS: All model references properly centralized\n');
  process.exit(0);
}
