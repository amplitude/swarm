# Swarm — Coherent Local-First Chat Template

**A clean, familiar chat app template for local-first agent applications.**  
No paid inference API, no cloud backend, no API keys, no local services — just your browser.  
The default model (`SmolLM2-135M-Instruct-q0f16-MLC`, ~359 MB) is downloaded and cached by your browser automatically via WebGPU.

---

## Why this approach?

| Concern | Swarm (WebLLM) | Cloud API |
|---------|----------------|-----------|
| Inference cost | $0 (your GPU + browser) | Per-token billing |
| Setup | Zero — opens and runs | API key + account |
| API keys | None needed | Requires account + key |
| Privacy | Everything in your browser | Data sent to provider |
| Offline | Works fully offline | Requires internet |
| Model quality | **Intentionally low** (135M params) | High (GPT-4, Claude) |
| First-run delay | One-time ~180 MB download | None |

**Zero-setup, honestly documented quality.** The default model (`SmolLM2-135M-Instruct-q0f16-MLC`) is the *smallest* available chat/instruct model in `@mlc-ai/web-llm` v0.2.82 at 135M parameters in full float16 precision. It is intentionally low quality — suitable for prototyping, layout testing, and simple conversations. It will struggle with complex reasoning, multi-step tasks, and consistent tool calling.

For better quality, select larger models in Settings (e.g., `SmolLM2-360M-Instruct-q4f16_1-MLC` at ~376 MB).

---

## Quickstart

```bash
pnpm install
pnpm dev
```

Open **http://localhost:5173/** in Chrome 113+ (or any WebGPU-enabled browser).  
No Ollama, no API keys, no configuration, no demo mode.

---

## What's included

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 |
| LLM | WebLLM / WebGPU (`SmolLM2-135M-Instruct-q0f16-MLC`, ~359 MB) |
| State | Zustand + Dexie.js/IndexedDB |
| Code sandbox | QuickJS WASM |
| Diagrams | Mermaid.js |
| Offline PWA | Service Worker via Vite PWA plugin |

**Key files to customize:**

| File / Directory | What it controls |
|---|---|
| `src/app/App.tsx` | Top-level app composition |
| `src/components/layout/` | Three-panel layout (sidebar, chat, inspector) |
| `src/components/chat/` | Message list, bubbles, composer |
| `src/components/right-panel/` | Agent inspector + task management |
| `src/components/settings/` | Model config, agent prompts, data export |
| `src/agents/` | Agent definitions, system prompts, handoff logic |
| `src/llm/` | WebLLM provider, model constants, capabilities |
| `src/tools/` | Tool definitions each agent can use |
| `src/store/` | Zustand state slices (conversations, sessions, tasks, agents) |
| `src/db/` | IndexedDB persistence schema |
| `src/types/` | TypeScript type definitions |

### Layout

```
┌──────────────────────────────────────────────────────┐
│                Model Status Bar                       │
├──────────┬───────────────────────────┬───────────────┤
│          │                           │               │
│ Sidebar  │      Chat / Messages      │  Inspector    │
│ (agents, │                           │  (collapsed)  │
│ threads) │      Composer (bottom)    │  - Agent info │
│          │                           │  - Tasks      │
│          │                           │               │
├──────────┴───────────────────────────┴───────────────┤
│                    Status Bar                         │
└──────────────────────────────────────────────────────┘
```

- **Sidebar** (collapsible, ~240px): Agent list with keyboard shortcuts (Cmd+1–5), conversation threads with create/rename/delete.
- **Chat** (center, fluid): Conversation messages with streaming, handoff approval widgets, and a clean composer with stop/retry.
- **Inspector** (collapsible right panel, default closed): Active agent status, quick agent handoff, manual task management.
- **Model Status** (top bar): Non-blocking download progress, error states, and WebGPU availability messaging. Never obscures the app.

---

## Architecture principles

### No fake behavior
- No DemoProvider or canned assistant responses
- No "continue without model" path
- If WebGPU is unavailable, the app shows a clear message and the send button is disabled with an explanation
- Test adapters exist only in tests and are tree-shaken from production builds

### Real browser inference
- Only WebLLM provider in production
- Auto-downloads and caches `SmolLM2-135M-Instruct-q0f16-MLC` on first run
- No Ollama setup gate or production Ollama requests

### Sessions and threads
- First install has one empty session and one empty thread
- Threads are titled from the first user message
- Drafts persist in sessionStorage
- Full CRUD with delete confirmation

### Tasks
- Manual create/edit/assign/complete/delete
- Associated with threads
- Never imply model execution

### Agent handoffs
- Agents propose handoffs, user approves/rejects/redirects
- Manual handoff persists a timeline event and switches the active agent
- Never generates fake agent chatter

---

## Model configuration

Currently supported model: **WebLLM** (only production provider).

| Model | Params | VRAM | Download | Quality |
|-------|--------|------|----------|---------|
| `SmolLM2-135M-Instruct-q0f16-MLC` (default) | 135M | ~359 MB | ~180 MB | Intentionally low |
| `SmolLM2-360M-Instruct-q4f16_1-MLC` | 360M | ~376 MB | ~200 MB | Low (better per VRAM) |
| `Qwen3-4B-q4f16_1-MLC` | 4B | ~3 GB | ~3 GB | Medium (expert, manual) |
| `Qwen3-8B-q4f16_1-MLC` | 8B | ~5 GB | ~5 GB | Good (expert, manual) |

Select larger models in Settings → Model.

---

## Theming — edit one file, restyle the entire app

All visual values (colors, radii, shadows, spacing, layout) live in a single file:

    src/styles/theme.css

**HSL channel syntax** — colors store `H S% L%` so Tailwind opacity modifiers work:

    --brand-500: 229 91% 65%;  /*  hsl(var(--brand-500) / <alpha-value>)  */
    bg-brand-500/50            /*  →  hsla(229, 91%, 65%, 0.5)            */

**Common variables to customize:**

| Variable | Default | Controls |
|----------|---------|----------|
| `--brand-500` | `229 91% 65%` | Primary interactive color |
| `--canvas` | `240 30% 14%` | App background |
| `--surface` | `240 21% 17%` | Card/panel background |
| `--text-primary` | `240 11% 97%` | Primary text |
| `--border-default` | `240 17% 29%` | Borders |
| `--radius-xl` | `0.75rem` | Message bubble rounding |
| `--control-height` | `1.75rem` | Button/input height |
| `--sidebar-width` | `15rem` | Sidebar width |
| `--content-max-width` | `48rem` | Chat content max width |

**Dark overrides** in `.dark {}` in the same file. See [docs/theming.md](docs/theming.md) for full guide.

---

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `VITE_LLM_MODEL` | `SmolLM2-135M-Instruct-q0f16-MLC` | Model ID override |

Runtime settings (localStorage):
- `swarm-model-id` — model identifier override
- `swarm-last-model` — last loaded model (auto-restored)

---

## Testing

```bash
# Full test suite (vitest, jsdom)
pnpm test:run

# Production build
pnpm build

# Type check
npx tsc --noEmit
```

### Test coverage
- **17 active test files** covering: model registry invariants, provider config, response parsing, state transitions, session CRUD, task CRUD, conversation title, chat flows, store behavior, UI rendering.
- **E2E tests** (Playwright): run with `npx playwright test` after building.
- **Test adapter**: available under `VITE_TEST_MODE=true` build flag for deterministic E2E responses. Tree-shaken from production builds.

---

## Deployment

Built output in `dist/` — serve with any static file server.  
The PWA service worker precaches 73 entries (~9.4 MB) for offline use.  
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## License

MIT — see [LICENSE](LICENSE).
