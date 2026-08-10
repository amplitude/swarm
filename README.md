# Swarm — Zero-Setup Local-First Agent App Template

**Fork or use this template to build your own local-first agent app.**  
No paid inference API, no cloud backend, no API keys — just your browser.  
The default model (`SmolLM2-360M-Instruct-q4f16_1-MLC`, ~376 MB) is downloaded and cached by your browser automatically via WebGPU.

---

## Why this approach?

| Concern | Swarm (WebLLM) | Cloud API | Ollama (expert mode) |
|---------|----------------|-----------|----------------------|
| Inference cost | $0 (your GPU + browser) | Per-token billing | $0 (your compute) |
| Setup | Zero — opens and runs | API key + account | Install Ollama + pull model |
| API keys | None needed | Requires account + key | None needed |
| Privacy | Everything in your browser | Data sent to provider | Local machine only |
| Offline | Works fully offline | Requires internet | Works fully offline |
| Model quality | Intentionally low (360M params) | High (GPT-4, Claude) | Low (0.5B) to medium (7B) |
| First-run delay | One-time ~376 MB download | None | One-time ~258 MB download |

**Zero-setup, intentionally low quality.** The default model is the smallest available in `@mlc-ai/web-llm` v0.2.82. Browser downloads and caches it automatically. Demo mode provides template responses when WebGPU is unavailable.

For higher quality, select larger models in Settings, or switch to Ollama (expert mode).

---

## Quickstart

```bash
pnpm install
pnpm dev
```

Open **http://localhost:5173/swarm/** in Chrome 113+ (or any WebGPU-enabled browser).  
No Ollama, no API keys, no configuration.

---

## What's included

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 |
| LLM (default) | WebLLM / WebGPU (`SmolLM2-360M-Instruct-q4f16_1-MLC`, ~376 MB) |
| LLM (expert) | Ollama (local, requires install) — selectable in Settings |
| LLM (fallback) | Demo mode — deterministic templates when WebGPU unavailable |
| State | Zustand + Dexie.js/IndexedDB |
| Code sandbox | QuickJS WASM |
| Diagrams | Mermaid.js |
| Offline PWA | Service Worker via Vite PWA plugin |

**Key files to customize:**

| File / Directory | What it controls |
|---|---|
| `src/agents/` | Agent definitions, system prompts, handoff logic |
| `src/llm/` | LLM providers, model config, fallback chain |
| `src/tools/` | Tool definitions each agent can use |
| `src/skills/` | Agent skill modules |
| `src/components/` | React UI components |
| `src/store/` | Zustand state slices |
| `src/db/` | IndexedDB persistence schema |
| `src/types/` | TypeScript type definitions |
| `src/styles/` | CSS design system / global styles |
| `tailwind.config.ts` | Custom theme, colors, spacing, animations |
| `vite.config.ts` | Build config, base URL, PWA manifest |

---

## Model configuration

### Default: WebLLM (zero-setup, no configuration)

- **Model:** `SmolLM2-360M-Instruct-q4f16_1-MLC` — verified as the smallest chat/instruct model in `@mlc-ai/web-llm` v0.2.82.
- **Size:** ~376 MB VRAM, estimated ~200 MB download.
- **Inference:** Browser WebGPU (Chrome 113+, Edge 113+).
- **Caching:** Automatic via browser Cache API. Downloaded once.
- **Cost:** $0. No API key, no paid API.

### Expert: Ollama (requires local install)

Available in Settings → Model → Inference Provider → Ollama.  
Requires Ollama to be installed and running. See [local-model.md](docs/local-model.md).

### Fallback: Demo mode

When WebGPU is unavailable or WebLLM initialization fails, Swarm enters **Demo Mode** — a deterministic template mode:
- Clearly labeled "Demo Mode (no AI)"
- Canned responses for common prompts
- Full UI remains functional (builder, canvas, navigation)
- Retry WebLLM and configure Ollama options in status bar

---

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `VITE_LLM_PROVIDER` | `webllm` | Inference provider: `webllm`, `ollama`, or `demo` |
| `VITE_OLLAMA_ENDPOINT` | `http://localhost:11434` | Ollama server URL (only when provider is `ollama`) |
| `VITE_LLM_MODEL` | `SmolLM2-360M-Instruct-q4f16_1-MLC` | Model ID |

Runtime settings (localStorage):
- `swarm-provider` — `"webllm"`, `"ollama"`, or `"demo"`
- `swarm-model-id` — model identifier
- `swarm-ollama-endpoint` — Ollama server URL
- `swarm-provider-explicit` — set when user makes an explicit provider choice

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

---

## Deployment

Built output in `dist/` — serve with any static file server.  
The app is deployed as a private GitHub Pages site for authenticated access.  
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for details.

## License

MIT — see [LICENSE](LICENSE).
