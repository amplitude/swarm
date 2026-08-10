#!/usr/bin/env node

/**
 * test-multi-tool.mjs — Live multi-tool workflow test
 *
 * Sends a single natural request requiring both 'get_weather' and 'calculator'
 * tools to Ollama's /api/chat. Iterates the tool loop:
 *   1. User request → model responds with tool call(s)
 *   2. Parse tool calls from text (mirroring app's response-parser.ts)
 *   3. Execute tools with mock results
 *   4. Feed results back to model for summarization
 *
 * Tests both models: qwen2.5-coder:0.5b (primary) and qwen2.5-coder:1.5b (fallback).
 * Saves full raw JSON to ../test-output/multi-tool-results.json
 *
 * Usage: node scripts/test-multi-tool.mjs
 */

import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const DIR = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(DIR, '..', 'test-output');
const OUT_FILE = join(OUT_DIR, 'multi-tool-results.json');

const OLLAMA_ENDPOINT = process.env.VITE_OLLAMA_ENDPOINT || 'http://localhost:11434';

// ---------------------------------------------------------------------------
// Tool definitions (mirrors app's tool schema format)
// ---------------------------------------------------------------------------

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a location',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name, e.g. Tokyo, London' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'] },
        },
        required: ['location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: 'Perform arithmetic calculations',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Math expression, e.g. 15 * 37 or 2 + 2' },
        },
        required: ['expression'],
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Text-based JSON parser (mirrors app's response-parser.ts approach)
// Extended to handle: single-line JSON, multi-line JSON, comma-separated JSON objects,
// and JSON inside markdown code fences.
// ---------------------------------------------------------------------------

function parseToolCallsFromText(content) {
  const calls = [];

  // Strip markdown code fences
  let text = content;
  const fenceMatch = text.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?```\s*$/);
  if (fenceMatch && fenceMatch[1] != null) {
    text = fenceMatch[1];
  }

  // Approach: join all non-empty lines into one compact string.
  // This handles multi-line JSON, single-line JSON, and comma-separated objects.
  const compact = text.split('\n').map(l => l.trim()).filter(Boolean).join('');

  if (!compact) return calls;

  // Try the compact string through all extraction methods
  const extracted = extractJsonObjects(compact);
  for (const obj of extracted) {
    const call = normalizeToolCall(obj);
    if (call) calls.push(call);
  }

  return calls;
}

/**
 * Try to extract complete JSON object(s) from a string.
 * Handles single objects and comma-separated sequences: {...},{...}
 */
function extractJsonObjects(text) {
  const results = [];

  // 1. Try parsing the entire text as a single JSON object
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null) {
      results.push(parsed);
      return results;
    }
  } catch {}

  // 2. Try with JSON repair
  try {
    const repaired = repairJson(text);
    if (repaired) {
      const parsed = JSON.parse(repaired);
      if (typeof parsed === 'object' && parsed !== null) {
        results.push(parsed);
        return results;
      }
    }
  } catch {}

  // 3. Try wrapping in array brackets: {...},{...} -> [{...},{...}]
  try {
    const arrayStr = '[' + text + ']';
    const parsed = JSON.parse(arrayStr);
    if (Array.isArray(parsed)) {
      return parsed.filter(item => typeof item === 'object' && item !== null);
    }
  } catch {}

  // 4. Try with repair on array wrapper
  try {
    const repairedArray = repairJson('[' + text + ']');
    if (repairedArray) {
      const parsed = JSON.parse(repairedArray);
      if (Array.isArray(parsed)) {
        return parsed.filter(item => typeof item === 'object' && item !== null);
      }
    }
  } catch {}

  // 5. Find individual JSON objects via regex matching balanced braces
  let remaining = text;
  const objRegex = /\{(?:[^{}]|\{(?:[^{}]|\{[^{}]*\})*\})*\}/g;
  let match;
  while ((match = objRegex.exec(remaining)) !== null) {
    try {
      const obj = JSON.parse(match[0]);
      if (typeof obj === 'object' && obj !== null) {
        results.push(obj);
      }
    } catch {}
  }

  return results;
}

/**
 * Normalize a parsed JSON object into a standardized tool call.
 */
function normalizeToolCall(obj) {
  if (typeof obj !== 'object' || obj === null) return null;

  // Format 1: {"tool_call": {"name": "...", "arguments": {...}}}
  if (obj.tool_call && typeof obj.tool_call === 'object') {
    const tc = obj.tool_call;
    if (typeof tc.name === 'string') {
      return {
        name: tc.name,
        arguments: (typeof tc.arguments === 'object' && tc.arguments !== null)
          ? tc.arguments : {},
      };
    }
  }

  // Format 2: {"name": "...", "arguments": {...}}
  if (typeof obj.name === 'string' && obj.arguments !== undefined) {
    return {
      name: obj.name,
      arguments: (typeof obj.arguments === 'object' && obj.arguments !== null)
        ? obj.arguments : {},
    };
  }

  return null;
}

function repairJson(text) {
  let s = text.trim();
  const original = s;
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  // Replace single quotes with double quotes
  s = s.replace(/'/g, '"');
  // Quote unquoted keys: {key: -> {"key":
  s = s.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
  return s !== original ? s : null;
}

// ---------------------------------------------------------------------------
// Ollama API helpers
// ---------------------------------------------------------------------------

async function ollamaChat(model, messages, tools) {
  const body = {
    model,
    messages,
    stream: false,
  };
  if (tools) body.tools = tools;

  const resp = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errorText = await resp.text().catch(() => 'unknown');
    throw new Error(`Ollama API error (HTTP ${resp.status}): ${errorText}`);
  }

  return resp.json();
}

// ---------------------------------------------------------------------------
// Mock tool executors
// ---------------------------------------------------------------------------

const TOOL_EXECUTORS = {
  get_weather: async (args) => {
    const loc = args.location || 'unknown';
    const unit = args.unit || 'celsius';
    const temp = unit === 'celsius' ? 22 : 72;
    return {
      location: loc,
      temperature: temp,
      unit,
      conditions: 'partly cloudy',
      humidity: '55%',
      timestamp: new Date().toISOString(),
    };
  },
  calculator: async (args) => {
    try {
      // SAFE: only basic arithmetic expressions from the model
      const expr = args.expression || '';
      // eslint-disable-next-line no-eval
      const result = eval(expr);
      return { expression: expr, result };
    } catch {
      return { expression: args.expression, error: 'could not evaluate' };
    }
  },
};

// ---------------------------------------------------------------------------
// Iterative multi-tool workflow — a true tool loop where results are fed back
// and the model can produce additional tool calls in subsequent rounds.
// ---------------------------------------------------------------------------

async function runWorkflow(modelId) {
  console.log(`\n═══ Multi-tool workflow: ${modelId} ═══\n`);

  const model = modelId.replace(/^ollama\//, '');
  const steps = [];
  const allToolResults = [];

  // Initial user request requiring both tools
  const userMessage = {
    role: 'user',
    content: "What's the weather in Tokyo right now and what is 15 times 37? Give me both answers.",
  };

  const messages = [userMessage];

  // ---- Iterative tool loop ----
  let round = 1;
  const maxToolRounds = 3;
  let finalSummary = '';

  while (round <= maxToolRounds) {
    console.log(`[${model}] ── Round ${round} ──`);
    console.log(`[${model}] Sending ${messages.length} messages to /api/chat...`);

    const response = await ollamaChat(model, messages, TOOLS);
    const rawContent = response.message?.content || '';
    const nativeCalls = response.message?.tool_calls || [];

    console.log(`[${model}] Response: ${rawContent.slice(0, 300).replace(/\n/g, '\\n')}`);

    steps.push({
      step: `round-${round}`,
      messages: messages.map(m => ({ role: m.role, tool: m.name })),
      response,
    });

    // Detect tool calls: native first, then text-based parsing
    let toolCalls = [];
    if (nativeCalls.length > 0) {
      console.log(`[${model}] Native tool_calls found: ${nativeCalls.length}`);
      for (const tc of nativeCalls) {
        if (tc.function) {
          toolCalls.push({
            name: tc.function.name,
            arguments: tc.function.arguments,
            source: 'native',
          });
        }
      }
    } else {
      // Text-based parsing (app's primary compatibility path)
      const parsedCalls = parseToolCallsFromText(rawContent);
      if (parsedCalls.length > 0) {
        console.log(`[${model}] Text-parsed tool calls: ${parsedCalls.length}`);
        for (const pc of parsedCalls) {
          console.log(`  -> ${pc.name}(${JSON.stringify(pc.arguments)})`);
          toolCalls.push({ ...pc, source: 'text' });
        }
      }
    }

    if (toolCalls.length === 0) {
      // No tool calls — this is the final answer
      finalSummary = rawContent;
      console.log(`[${model}] No tool calls — final answer.`);
      break;
    }

    console.log(`[${model}] Executing ${toolCalls.length} tool call(s)...`);

    // Push the assistant's response (with tool calls) into the message history
    const assistantMsg = {
      role: 'assistant',
      content: rawContent || null,
    };
    // Add native tool_calls structure if present
    if (nativeCalls.length > 0) {
      assistantMsg.tool_calls = nativeCalls;
    }
    messages.push(assistantMsg);

    // Execute each tool call
    for (const tc of toolCalls) {
      const executor = TOOL_EXECUTORS[tc.name];
      if (!executor) {
        console.log(`[${model}] Unknown tool: ${tc.name}`);
        continue;
      }

      console.log(`  [${tc.source}] ${tc.name}(${JSON.stringify(tc.arguments)})`);
      const result = await executor(tc.arguments);
      console.log(`  Result: ${JSON.stringify(result).slice(0, 200)}`);

      messages.push({
        role: 'tool',
        content: JSON.stringify(result),
        name: tc.name,
      });

      allToolResults.push({ tool: tc.name, args: tc.arguments, result, source: tc.source });
    }

    round++;
  }

  // If after the tool loop we still don't have a final answer, ask for summarization
  if (!finalSummary && messages[messages.length - 1]?.role === 'tool') {
    const summaryRequest = {
      role: 'user',
      content: 'Now please summarize in plain English: what is the weather in Tokyo and what is 15 times 37?',
    };
    messages.push(summaryRequest);

    console.log(`[${model}] Asking for final summary...`);
    const response = await ollamaChat(model, messages, TOOLS);
    finalSummary = response.message?.content || '';

    steps.push({
      step: 'final-summary',
      messages: messages.map(m => ({ role: m.role, tool: m.name })),
      response,
      summary: finalSummary,
    });
  } else if (finalSummary) {
    steps.push({ step: 'final-summary', summary: finalSummary });
  }

  const distinctTools = [...new Set(allToolResults.map(r => r.tool))];
  console.log(`[${model}] ✅ Workflow complete — ${distinctTools.length} distinct tools used: [${distinctTools.join(', ')}]`);
  console.log(`[${model}] Final answer: ${finalSummary.slice(0, 300)}`);

  return {
    model,
    status: allToolResults.length > 0 ? 'complete' : 'no-tools-detected',
    toolCalls: allToolResults,
    toolsUsed: distinctTools,
    finalSummary,
    steps,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  // Check Ollama connectivity
  console.log(`Checking Ollama at ${OLLAMA_ENDPOINT}...`);
  let models;
  try {
    const resp = await fetch(`${OLLAMA_ENDPOINT}/api/tags`);
    const data = await resp.json();
    models = data.models || [];
    console.log(`Found ${models.length} models`);
    for (const m of models) {
      console.log(`  - ${m.name} (${(m.size / 1024 / 1024).toFixed(0)} MB)`);
    }
  } catch (err) {
    console.error(`Cannot reach Ollama: ${err.message}`);
    console.error('Make sure Ollama is running. See docs/local-model.md');
    process.exit(1);
  }

  const modelIds = ['ollama/qwen2.5-coder:0.5b', 'ollama/qwen2.5-coder:1.5b'];
  const results = {};

  for (const modelId of modelIds) {
    const bare = modelId.replace(/^ollama\//, '');
    const available = models.some(m => m.name === bare || m.name.startsWith(bare.replace(/:.*$/, '') + ':'));
    if (!available) {
      console.log(`\nModel ${bare} not pulled — skipping. Pull with: ollama pull ${bare}`);
      results[modelId] = { status: 'not-available' };
      continue;
    }
    results[modelId] = await runWorkflow(modelId);
  }

  // Save results
  const output = {
    timestamp: new Date().toISOString(),
    endpoint: OLLAMA_ENDPOINT,
    results,
  };

  writeFileSync(OUT_FILE, JSON.stringify(output, null, 2));
  console.log(`\nResults saved to ${OUT_FILE}`);

  // Summary
  console.log('\n══════════════════════════════════════');
  console.log('        MULTI-TOOL RESULTS SUMMARY     ');
  console.log('══════════════════════════════════════');
  for (const [modelId, result] of Object.entries(results)) {
    if (result.status === 'not-available') {
      console.log(`  ${modelId}: NOT AVAILABLE (not pulled)`);
      continue;
    }
    if (result.status === 'no-tools-detected') {
      console.log(`  ${modelId}: ⚠ NO TOOL CALLS DETECTED (text-only response)`);
      continue;
    }
    const toolCount = result.toolCalls?.length || 0;
    const tools = result.toolsUsed || [];
    console.log(`  ${modelId}: ✅ ${toolCount} tool calls across ${tools.length} tools [${tools.join(', ')}]`);
    console.log(`          Final answer: ${(result.finalSummary || '(empty)').slice(0, 100).replace(/\n/g, ' ')}`);
  }

  // Return exit code based on whether at least one model completed
  const anyComplete = Object.values(results).some(r => r.status === 'complete');
  process.exit(anyComplete ? 0 : 1);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
