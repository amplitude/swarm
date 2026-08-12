# Swarm — Single-File Local-First Agent

**Everything in one HTML file.** Production UI, CSS, event emitter, tool calling,
orchestration, WebLLM integration, fake query modes, caps, timeout, abort handling,
and fallback — all in `index.html`. No build step, no framework, no API keys.

The default model (`SmolLM2-135M-Instruct-q0f16-MLC`, ~359 MB) is downloaded and
cached by your browser automatically via WebGPU and `@mlc-ai/web-llm` v0.2.82.

---

## Quickstart

```bash
# Install dependencies (Playwright for testing)
npm install

# Start the static server
npm start
```

Open **http://localhost:4173/** in Chrome 113+ (or any WebGPU-enabled browser).

---

## How it works

| Concern | Swarm (single-file) |
|---------|---------------------|
| Architecture | 1 file: `index.html` (~41 KB) |
| LLM | WebLLM via `@mlc-ai/web-llm` 0.2.82 from CDN |
| Model | `SmolLM2-135M-Instruct-q0f16-MLC` (~180 MB download, ~359 MB VRAM) |
| Tool | `inspect_message` — always called before every response |
| Events | `CustomEvent('agent-event')` + `window.agentEvents[]` |
| Input cap | 2000 characters |
| Response cap | 600 characters display |
| Timeout | 30 seconds per turn |
| Cost | $0 (your GPU + browser) |
| Setup | Zero — opens and runs |
| API keys | None needed |
| Privacy | Everything in your browser |
| Offline | Works fully offline after first load |

### Orchestration per turn

Every accepted user turn follows the same app-orchestrated flow:

1. **`user_message`** event fires when the user sends a message
2. **`inspect_message` tool** is called automatically (not by the LLM)
3. Tool result + user message → LLM for response generation
4. **`ai_response`** event fires with the model's response

```
User sends message ──→ user_message event
                    ──→ inspect_message() tool executes (deterministic)
                    ──→ LLM generates response (WebLLM or fake)
                    ──→ ai_response event
```

### Fake query modes

For testing without WebGPU, append `?mode=<mode>` to the URL. These modes
use the same orchestration path but bypass WebGPU/model import entirely:

| Mode | URL | Behavior |
|------|-----|----------|
| success | `?mode=success` | Returns a fake successful response |
| empty | `?mode=empty` | Returns no content (tests fallback) |
| overlong | `?mode=overlong` | Returns content >600 chars (tests cap) |
| error | `?mode=error` | Simulates an error during generation |
| timeout | `?mode=timeout` | Hangs until the 30s timeout triggers |

All fake modes produce zero external API requests and require no WebGPU.

### Download vs local inference

The `@mlc-ai/web-llm` library is loaded from CDN on first page load (~3 MB JS).
The model (`SmolLM2-135M-Instruct-q0f16-MLC`) is then downloaded and cached by
your browser (~180 MB). All inference runs locally on your GPU via WebGPU.

**Why download?** WebLLM packages model weights as downloadable assets that are
cached by the browser's Cache API. This avoids bundling hundreds of MB into the
repo while still enabling fully offline inference after the first download.

**Why not an inference API?** No data leaves your machine. No API keys, no
per-token billing, no rate limits, no vendor lock-in.

---

## Testing

```bash
# Run all tests (requires server to be running or uses webServer in playwright config)
npx playwright test

# Run with visible browser
npx playwright test --headed

# Run a single test file
npx playwright test tests/agent.spec.js
```

### Test coverage

A single test file (`tests/agent.spec.js`) covers:

| # | Test | What it verifies |
|---|------|-----------------|
| 1 | Success order | `user_message` → `inspect_message` → `ai_response` in sequence |
| 2 | Deterministic tool | `inspect_message` returns expected structure every time |
| 3 | Event hook | `CustomEvent('agent-event')` fires; `window.agentEvents` populated |
| 4 | Input cap | 2000-char textarea `maxlength` enforced |
| 5 | Empty fallback | Empty model response triggers `diagnostic_error` + fallback |
| 6 | Error fallback | Error mode produces `diagnostic_error` event |
| 7 | Overlong cap | Response >600 chars is truncated |
| 8 | Timeout | 30s timeout triggers `generation_stopped` event |
| 9 | Duplicate suppression | Second send blocked while generating |
| 10 | No external requests | All 5 fake modes make zero API calls |

---

## Files

```
├── index.html            ← Everything: UI, CSS, JS, WebLLM, orchestration
├── server.mjs            ← Minimal Node.js static file server
├── package.json          ← Playwright + npm scripts
├── playwright.config.js  ← Playwright test configuration
├── tests/
│   └── agent.spec.js     ← Single comprehensive test file
├── .github/              ← CI/CD workflows (preserved)
└── LICENSE               ← MIT license
```

---

## Architecture

### Event system

Two ways to observe events:

```javascript
// 1. CustomEvent listener
document.addEventListener('agent-event', (e) => {
  console.log(e.detail.type, e.detail.data);
});

// 2. window.agentEvents array (appended on every dispatch)
console.log(window.agentEvents);
```

Event types: `user_message`, `tool_call`, `ai_response`, `diagnostic_error`, `generation_stopped`

### data-testid selectors

All interactive elements carry stable `data-testid` attributes:

| Selector | Element |
|----------|---------|
| `[data-testid="status-bar"]` | Top status bar |
| `[data-testid="status-dot"]` | Status indicator dot |
| `[data-testid="status-text"]` | Status text |
| `[data-testid="composer-input"]` | Message input textarea |
| `[data-testid="send-btn"]` | Send button |
| `[data-testid="stop-btn"]` | Stop generation button |
| `[data-testid="char-count"]` | Character count display |
| `[data-testid="message-bubble"]` | Individual message bubble |
| `[data-testid="tool-call-card"]` | Tool call result card |
| `[data-testid="error-banner"]` | Error notification banner |
| `[data-testid="clear-chat-btn"]` | Clear conversation button |
| `[data-testid="theme-toggle-btn"]` | Theme toggle button |

### Configuration

All limits are defined as `CONFIG` constants at the top of the script in `index.html`:

| Constant | Default | Description |
|----------|---------|-------------|
| `MAX_INPUT_CHARS` | 2000 | Input textarea character limit |
| `MAX_TOKENS` | 128 | `max_tokens` sent to the LLM |
| `STREAM_COLLECT` | 1000 | Chars collected before emitting final response |
| `MAX_RESPONSE_CHARS` | 600 | Display cap for response text |
| `TIMEOUT_MS` | 30000 | Per-turn timeout in milliseconds |
| `DEFAULT_MODEL` | `SmolLM2-135M-Instruct-q0f16-MLC` | Model loaded on startup |

---

## License

MIT — see [LICENSE](LICENSE).
