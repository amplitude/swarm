#!/usr/bin/env node

/**
 * Live tool-selection test against Ollama's /api/chat.
 *
 * Tests both qwen2.5-coder:0.5b and qwen2.5-coder:1.5b with a realistic
 * tool schema (weather + calculator). The model must independently select
 * the correct tool for a natural-language task.
 *
 * Checks TWO paths:
 *   1. Native Ollama tool_calls (message.tool_calls)
 *   2. Text-based JSON tool calls (app's response-parser path)
 *
 * Usage: node scripts/test-tool-selection.mjs
 */

const OLLAMA_ENDPOINT = process.env.OLLAMA_ENDPOINT || 'http://localhost:11434';

const MODELS = [
  { id: 'qwen2.5-coder:0.5b', label: '0.5B' },
  { id: 'qwen2.5-coder:1.5b', label: '1.5B' },
];

const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'get_weather',
      description: 'Get the current weather for a given city',
      parameters: {
        type: 'object',
        properties: {
          location: { type: 'string', description: 'City name, e.g. Paris, Tokyo' },
          unit: { type: 'string', enum: ['celsius', 'fahrenheit'], default: 'celsius' },
        },
        required: ['location'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculator',
      description: 'Perform a mathematical calculation',
      parameters: {
        type: 'object',
        properties: {
          expression: { type: 'string', description: 'Math expression to evaluate, e.g. 15 * 37' },
        },
        required: ['expression'],
      },
    },
  },
];

const TESTS = [
  {
    name: 'weather', expectedTool: 'get_weather',
    userMessage: 'What is the current weather in Tokyo?',
  },
  {
    name: 'calculator', expectedTool: 'calculator',
    userMessage: 'Can you calculate 15 times 37 for me?',
  },
];

// ---------------------------------------------------------------------------
// Minimal JSON tool-call parser (mirrors src/llm/response-parser.ts logic)
// ---------------------------------------------------------------------------

function parseTextToolCalls(content) {
  const toolCalls = [];

  // Remove markdown code fences
  let text = content;
  const fenceMatch = text.match(/^```(?:json)?\s*\n?([\s\S]*?)```\s*$/);
  if (fenceMatch && fenceMatch[1] != null) {
    text = fenceMatch[1];
  }

  // Try parsing entire text as a tool call JSON
  if (text.startsWith('{')) {
    const parsed = tryParseToolCallObject(text);
    if (parsed) {
      toolCalls.push(parsed);
      return toolCalls;
    }
  }

  // Try line by line
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parsed = tryParseToolCallObject(trimmed);
    if (parsed) toolCalls.push(parsed);
  }

  return toolCalls;
}

function tryParseToolCallObject(text) {
  let raw = text;
  if (raw.startsWith('```') && raw.endsWith('```')) {
    raw = raw.slice(3, -3).replace(/^json\s*/, '');
  }

  let obj;
  try {
    obj = JSON.parse(raw);
  } catch {
    const repaired = repairJson(raw);
    if (!repaired) return null;
    try { obj = JSON.parse(repaired); } catch { return null; }
  }

  if (typeof obj !== 'object' || obj === null) return null;
  const rec = obj;

  // Format: {"tool_call": {"name": "...", "arguments": {...}}}
  if (rec.tool_call && typeof rec.tool_call === 'object') {
    const tc = rec.tool_call;
    if (typeof tc.name === 'string') {
      return { name: tc.name, arguments: tc.arguments || {} };
    }
  }

  // Format: {"name": "...", "arguments": {...}}
  if (typeof rec.name === 'string' && rec.arguments !== undefined) {
    return { name: rec.name, arguments: rec.arguments };
  }

  return null;
}

function repairJson(text) {
  let s = text.trim();
  s = s.replace(/,\s*([}\]])/g, '$1');
  s = s.replace(/'/g, '"');
  s = s.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
  return s !== text.trim() ? s : null;
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

function delay(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function testModel(modelId, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing ${label} (${modelId})`);
  console.log(`${'='.repeat(60)}`);

  for (const test of TESTS) {
    console.log(`\n  --- ${test.name} ---`);
    console.log(`  Task: "${test.userMessage}"`);

    const startTime = Date.now();

    try {
      const response = await fetch(`${OLLAMA_ENDPOINT}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: modelId,
          messages: [
            { role: 'system', content: [
              'You are a helpful assistant with access to tools.',
              'When you need to use a tool, respond with a JSON object on a line by itself.',
              'Do NOT wrap it in markdown code blocks. Just the raw JSON.',
            ].join('\n') },
            { role: 'user', content: test.userMessage },
          ],
          tools: TOOLS,
          stream: false,
        }),
        signal: AbortSignal.timeout(30000),
      });

      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        const text = await response.text().catch(() => 'unknown');
        console.log(`  HTTP ${response.status}: ${text.slice(0, 200)}`);
        console.log(`  LATENCY: ${latencyMs}ms`);
        console.log(`  NATIVE tool_calls: N/A`);
        console.log(`  TEXT-PARSED tool calls: N/A`);
        continue;
      }

      const data = await response.json();
      const message = data.message || {};
      const content = message.content || '';
      const rawToolCalls = message.tool_calls || [];

      // Path 1: Native tool_calls from Ollama API
      let nativeValid = false;
      if (rawToolCalls.length > 0) {
        const tc = rawToolCalls[0];
        nativeValid = tc.function?.name === test.expectedTool;
        console.log(`  NATIVE tool_calls: ${tc.function?.name}`);
        console.log(`  NATIVE args: ${JSON.stringify(tc.function?.arguments || {})}`);
        console.log(`  NATIVE valid: ${nativeValid}`);
      } else {
        console.log(`  NATIVE tool_calls: (none in API response)`);
        console.log(`  NATIVE valid: N/A`);
      }

      // Path 2: Text-based JSON parsing (app's response-parser path)
      const parsedCalls = parseTextToolCalls(content);
      let textValid = false;
      if (parsedCalls.length > 0) {
        const pc = parsedCalls[0];
        textValid = pc.name === test.expectedTool;
        console.log(`  TEXT-PARSED tool calls: ${pc.name}`);
        console.log(`  TEXT-PARSED args: ${JSON.stringify(pc.arguments)}`);
        console.log(`  TEXT-PARSED valid: ${textValid}`);
      } else {
        console.log(`  TEXT-PARSED tool calls: (none found in content)`);
        console.log(`  TEXT-PARSED valid: N/A`);
      }

      console.log(`  CONTENT (first 200 chars): ${content.slice(0, 200).replace(/\n/g, '\\n')}`);
      console.log(`  LATENCY: ${latencyMs}ms`);
      console.log(`  OVERALL: ${nativeValid || textValid ? 'PASS' : 'FAIL'} (${latencyMs}ms)`);

    } catch (err) {
      const latencyMs = Date.now() - startTime;
      console.log(`  ERROR: ${err.message.slice(0, 200)}`);
      console.log(`  LATENCY: ${latencyMs}ms`);
    }

    await delay(500);
  }
}

async function main() {
  console.log('=== Live Tool-Selection Test ===');
  console.log(`Endpoint: ${OLLAMA_ENDPOINT}`);
  console.log(`Date: ${new Date().toISOString()}`);
  console.log(`Models: ${MODELS.map(m => m.id).join(', ')}`);

  // Verify Ollama
  try {
    const resp = await fetch(`${OLLAMA_ENDPOINT}/api/tags`, { signal: AbortSignal.timeout(5000) });
    const data = await resp.json();
    const modelNames = (data.models || []).map(m => `${m.name} (${(m.size/1e6).toFixed(0)}MB)`);
    console.log('Ollama models:', modelNames.join(', '));
  } catch (err) {
    console.error(`Cannot reach Ollama: ${err.message}`);
    process.exit(1);
  }

  for (const model of MODELS) {
    await testModel(model.id, model.label);
  }

  console.log(`\nDone.`);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
