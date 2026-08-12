/**
 * Swarm — Local-First Agent Server
 *
 * Minimal Node.js server: serves static frontend + POST /api/chat.
 * All orchestration runs here: inspect_message → local LLM → response.
 *
 * Exports runChat and inspectMessage for direct testing.
 *
 * Run:       node server.mjs
 * Fake mode: SWARM_FAKE=true node server.mjs
 * Port:      4173 (matches playwright config)
 */
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = 4173;

// ═══════════════════════════════════════════════════════════════════════
// MODEL — lazy-init: downloaded once, cached forever
// ═══════════════════════════════════════════════════════════════════════

const MODEL_URL =
  'https://huggingface.co/TheBloke/TinyLlama-1.1B-Chat-v1.0-GGUF/resolve/main/tinyllama-1.1b-chat-v1.0.Q3_K_L.gguf';

export const modelState = {
  status: 'loading', // loading | ready | fallback | fake
  session: null,
  llama: null,
  error: null,
  loaded: false,
};

let initPromise = null;

export async function ensureModel() {
  if (process.env.SWARM_FAKE) {
    modelState.status = 'fake';
    modelState.loaded = false;
    return;
  }
  if (initPromise) return initPromise;
  if (modelState.loaded) return;

  initPromise = (async () => {
    try {
      console.log('[swarm] Loading model (TinyLlama-1.1B, ~592 MB)…');
      const { getLlama, LlamaChatSession, resolveModelFile } = await import('node-llama-cpp');

      const modelDir = join(__dirname, 'models');
      if (!existsSync(modelDir)) mkdirSync(modelDir, { recursive: true });

      const modelPath = await resolveModelFile(MODEL_URL, { dir: modelDir });
      console.log('[swarm] Model path:', modelPath);

      const llama = await getLlama({});
      console.log('[swarm] llama.cpp backend ready, GPU:', llama.gpu);

      const model = await llama.loadModel({ modelPath });
      const context = await model.createContext({ contextSize: 1024 });
      const sequence = context.getSequence();

      const session = new LlamaChatSession({
        context,
        contextSequence: sequence,
        systemPrompt:
          'You are Swarm, a helpful local-first agent assistant. Keep your responses concise and useful.',
      });

      modelState.llama = llama;
      modelState.session = session;
      modelState.status = 'ready';
      modelState.loaded = true;
      modelState.modelName = 'tinyllama-1.1b';
      console.log('[swarm] Model ready — listening on http://localhost:' + PORT);
    } catch (err) {
      console.error('[swarm] Model load failed:', err.message);
      modelState.status = 'fallback';
      modelState.error = err.message;
    }
  })();

  return initPromise;
}

// ═══════════════════════════════════════════════════════════════════════
// TOOL: inspect_message (deterministic, always runs first)
// ═══════════════════════════════════════════════════════════════════════

export function inspectMessage(message) {
  const words = message.split(/\s+/).filter(Boolean);
  return {
    messageLength: message.length,
    wordCount: words.length,
    hasQuestion: message.includes('?'),
    hasExclamation: message.includes('!'),
    hasCode: /`|```|function|const|let|var|import|export/.test(message),
    isOverlong: message.length > 2000,
    classification: message.length < 10 ? 'short' : message.length < 100 ? 'medium' : 'long',
    sentiment: /thank|great|awesome|nice|good|love/i.test(message) ? 'positive'
             : /bad|terrible|awful|hate|wrong|error/i.test(message) ? 'negative'
             : 'neutral',
    timestamp: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// FALLBACK RESPONSE (deterministic, no model needed)
// ═══════════════════════════════════════════════════════════════════════

const FALLBACK_RESPONSES = [
  "I understand your message, but I'm currently running in fallback mode without a loaded model. Your message has been inspected and logged.",
  "Thanks for your message. My local language model isn't available right now, so I'm responding with this fallback template. Your input was analyzed by the inspect_message tool.",
  "Got it. I'm operating in fallback mode — your message was inspected and received, but I need a model to generate a tailored response. Try again later or start the server with a working model.",
];

export const FALLBACK_LABEL = '\u26A1 Fallback response \u2014 model unavailable';

function fallbackResponse(inspection) {
  const idx = inspection.wordCount % FALLBACK_RESPONSES.length;
  return FALLBACK_RESPONSES[idx];
}

// ═══════════════════════════════════════════════════════════════════════
// FAKE PROVIDER (for testing — no model, no download, no inference)
// Only reachable when SWARM_FAKE=true (checked by caller)
// ═══════════════════════════════════════════════════════════════════════

function fakeResponse(mode) {
  switch (mode) {
    case 'success':
      return { content: 'This is a fake success response from the Swarm agent. The inspect_message tool has classified your input and I am responding accordingly. All systems nominal.', finishReason: 'stop' };
    case 'empty':
      return { content: null, finishReason: 'stop' };
    case 'error':
      throw new Error('FAKE_MODE_ERROR: Simulated model error for testing fallback behavior.');
    case 'timeout':
      return { content: 'The request timed out (simulated). Using fallback response.', finishReason: 'stop' };
    case 'overlong':
      return { content: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. '.repeat(30).slice(0, 1200), finishReason: 'stop' };
    default:
      return { content: 'Unknown fake mode.', finishReason: 'stop' };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// ORCHESTRATOR — message → inspect_message → local LLM → response
//
// Exported for unit testing with dependency injection via `options`:
//   options.state    — override modelState (e.g. { status:'fake', loaded:false })
//   options.session  — mock session with .prompt() for testing prompt dataflow
//   options.modelName — override model name in response
// ═══════════════════════════════════════════════════════════════════════

export async function runChat(userMessage, userId, sessionId, mode, options = {}) {
  // 1. Inspect message — always runs first, deterministic, no side effects
  const inspection = inspectMessage(userMessage);

  // Resolve state from injection or global modelState
  const state = options.state || modelState;
  const session = options.session || state.session;

  // 2. Fake env mode (SWARM_FAKE=true) — mode is ONLY honored when env is fake.
  //    Clients cannot force fake behavior on a real server.
  const fakeModes = ['success', 'empty', 'error', 'overlong', 'timeout'];
  if (state.status === 'fake' && mode && fakeModes.includes(mode)) {
    try {
      const result = fakeResponse(mode);
      return {
        response: result.content || '',
        finishReason: result.finishReason,
        inspection,
        model: 'fake',
        mode,
      };
    } catch (err) {
      return {
        response: fallbackResponse(inspection),
        finishReason: 'fallback',
        inspection,
        model: 'fake',
        mode,
        fallbackReason: err.message,
        fallbackLabel: '\u26A1 Fake error \u2014 deterministic fallback',
      };
    }
  }

  // 3. Fake env without specific mode
  if (state.status === 'fake') {
    return {
      response: `[Fake mode] Message inspected: ${inspection.classification}, ${inspection.wordCount} words. Enable real mode by removing SWARM_FAKE.`,
      finishReason: 'stop',
      inspection,
      model: 'fake',
      mode: 'env',
    };
  }

  // 4. Model failed to load — fallback state
  if (state.status === 'fallback' || !state.loaded) {
    return {
      response: fallbackResponse(inspection),
      finishReason: 'fallback',
      inspection,
      model: 'fallback',
      fallbackReason: state.error || 'Model not loaded',
      fallbackLabel: FALLBACK_LABEL,
    };
  }

  // 5. Model is ready — generate response
  if (!session) {
    return {
      response: fallbackResponse(inspection),
      finishReason: 'fallback',
      inspection,
      model: 'fallback',
      fallbackReason: 'No session available',
      fallbackLabel: FALLBACK_LABEL,
    };
  }

  try {
    // The model always receives inspection context + original user message
    const inspectionContext =
      `[Inspection of user message: ${JSON.stringify(inspection)}]`;
    const fullPrompt = `${inspectionContext}\n\nUser: ${userMessage}`;

    const content = await session.prompt(fullPrompt);

    return {
      response: content || '',
      finishReason: 'stop',
      inspection,
      model: options.modelName || state.modelName || 'tinyllama-1.1b',
    };
  } catch (err) {
    console.error('[swarm] Inference error:', err.message);
    return {
      response: fallbackResponse(inspection),
      finishReason: 'fallback',
      inspection,
      model: 'fallback',
      fallbackReason: err.message,
      fallbackLabel: '\u26A1 Inference error \u2014 deterministic fallback',
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════
// STATIC FILE SERVER
// ═══════════════════════════════════════════════════════════════════════

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript; charset=utf-8',
  '.css':  'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
  '.wasm': 'application/wasm',
};

// ═══════════════════════════════════════════════════════════════════════
// HTTP SERVER
// ═══════════════════════════════════════════════════════════════════════

function createApp() {
  return createServer(async (req, res) => {
    // ── CORS (for local dev) ──
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // ── POST /api/chat ──
    if (req.url === '/api/chat') {
      if (req.method !== 'POST') {
        res.writeHead(405, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Method not allowed' }));
        return;
      }

      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', async () => {
        try {
          const parsed = JSON.parse(body);
          const message = (parsed.message || '').trim();
          const userId = parsed.userId !== undefined && parsed.userId !== null
            ? String(parsed.userId) : 'anonymous';
          const sessionId = parsed.sessionId !== undefined && parsed.sessionId !== null
            ? String(parsed.sessionId) : 'default';

          if (!message) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'message is required' }));
            return;
          }

          // Oversized message guard (soft — 2000 is the UI limit, 10000 is safety net)
          if (message.length > 10000) {
            res.writeHead(413, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'message too long (max 10000 characters)' }));
            return;
          }

          const result = await runChat(message, userId, sessionId, parsed.mode || null);

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(result));
        } catch (parseErr) {
          if (parseErr instanceof SyntaxError) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'Invalid JSON body' }));
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: parseErr.message }));
          }
        }
      });
      return;
    }

    // ── Static files ──
    let path = req.url.split('?')[0];
    try { path = decodeURIComponent(path); } catch { /* malformed */ }
    if (path === '/' || path === '') path = '/index.html';
    const filePath = join(__dirname, path);

    if (!filePath.startsWith(__dirname)) {
      res.writeHead(403);
      res.end('Forbidden');
      return;
    }

    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }

    const ext = extname(filePath);
    const contentType = MIME[ext] || 'application/octet-stream';
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

// ═══════════════════════════════════════════════════════════════════════
// START (only when run directly, not when imported as module)
// ═══════════════════════════════════════════════════════════════════════

const isMain =
  process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  const server = createApp();
  server.listen(PORT, () => {
    console.log(`[swarm] Server → http://localhost:${PORT}`);
    // ensureModel checks SWARM_FAKE internally and sets state accordingly
    ensureModel().catch(() => {});
  });
}
