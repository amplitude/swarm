# Swarm — Local-First Agent

**Minimal frontend + backend local-agent app.** The frontend is a dumb HTML
chat UI. All intelligence — `inspect_message`, orchestration, LLM inference —
lives in the Node.js server. No build step, no framework, no API keys.

The server auto-downloads a small GGUF model (TinyLlama-1.1B, ~592 MB) on first
run and caches it in `~/.node-llama-cpp/models/`. All inference runs locally on
your CPU/GPU via [node-llama-cpp](https://github.com/withcatai/node-llama-cpp).

---

## Quickstart

```bash
# Install dependencies (node-llama-cpp + Playwright for testing)
npm install

# Start the server (auto-downloads TinyLlama-1.1B on first run)
npm start

# Or run in fake mode (no model, no download, no GPU needed)
npm run start:fake
```

Open **http://localhost:4173/** in any browser.

---

## How it works

| Concern | Swarm |
|---------|-------|
| Frontend | `index.html` — dumb chat UI, sends fetch POST to `/api/chat` |
| Backend | `server.mjs` — static server + `POST /api/chat` endpoint |
| LLM | `node-llama-cpp` — native Node.js bindings to llama.cpp |
| Model | TinyLlama-1.1B-Chat-v1.0 (Q3_K_L, ~592 MB, auto-downloaded) |
| Tool | `inspect_message` — deterministic, always runs before response |
| Fallback | If model load fails → useful static response (no crash) |
| Fake mode | `SWARM_FAKE=true` — zero imports, zero downloads, zero inference |
| Cost | $0 (your CPU/GPU) |
| API keys | None needed |
| Privacy | Everything runs locally |

### Orchestration per turn

Every chat request follows the same flow:

```
Client sends POST /api/chat { message, userId, sessionId }
  ──→ server.inspectMessage(message)    # deterministic tool
  ──→ server.llamaSession.prompt(...)   # local LLM inference
  ──→ { response, inspection, model }   # JSON response
```

### Fake query modes (test only — gated on SWARM_FAKE=true)

For testing without model download, pass the `mode` in the request body or
append `?mode=<mode>` to the URL (the frontend forwards it). **The `mode`
parameter is only honored when `SWARM_FAKE=true`** — clients cannot force fake
behavior on a real server. In production mode, `mode` is silently ignored.

| Mode | Description |
|------|-------------|
| `success` | Returns a canned success response |
| `empty` | Returns empty string (tests empty handling) |
| `error` | Simulates an error (caught, returns fallback) |
| `overlong` | Returns content >600 chars |
| `timeout` | Returns immediately (no actual timeout at API level) |

### Fallback

If the model fails to download, load, or generate (e.g. missing binary, out of
memory, incompatible hardware), the server returns a deterministic fallback
response drawn from a rotating set of templates. The response includes a
`fallbackLabel` field (e.g. "⚡ Fallback response — model unavailable") which
the frontend renders as a visible amber badge above the message content.
The HTTP status is always 200 — the API remains useful after model failures.

---

## Testing

```bash
# Run all tests (starts server in fake mode automatically)
npx playwright test

# Run with visible browser
npx playwright test --headed

# Run a single test file
npx playwright test tests/agent.spec.js
```

### Test coverage

Two test domains covering all fake modes, API contracts, and UI rendering:

**API tests** (via `request` fixture):
- Success mode returns expected response structure (response, finishReason, model, inspection)
- Empty mode returns empty string response
- Error mode returns fallback response despite simulated error
- Overlong mode returns content >600 chars
- `inspect_message` always returns deterministic structure
- Empty message returns 400 error

**UI tests** (via `page` fixture):
- User and assistant messages render correctly
- Empty response shows `[No response]` fallback
- 2000-char input cap enforced
- Clear button removes all messages
- Mode badge visible for fake modes
- Chat area centered with symmetric padding
- Messages respect 85% max-width constraint

---

## Files

```
├── index.html            ← Dumb chat UI (no model logic)
├── server.mjs            ← Node.js server + model + orchestration
├── package.json          ← node-llama-cpp + Playwright
├── playwright.config.js  ← Playwright test configuration
├── tests/
│   └── agent.spec.js     ← API + UI tests
├── .github/              ← CI/CD workflows
└── LICENSE               ← MIT license
```

---

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SWARM_FAKE` | *(unset)* | Set to `true` to skip model loading entirely |

---

## License

MIT — see [LICENSE](LICENSE).
