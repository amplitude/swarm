# Swarm — Local-First Agent App Template

**Fork or use this template to build your own local-first agent app.**  
No paid inference API, no cloud backend, no API keys — just your browser and a local Ollama service.  
Experiment with small models (0.5B–1.5B), customize agents, prompts, tools, and UI, and ship your own branded agent product.

---

## Why local models?

| Concern | Local (Ollama) | Cloud API |
|---------|----------------|-----------|
| Inference cost | $0 (your own compute + disk) | Per-token billing |
| API keys | None needed | Requires account + key |
| Privacy | Everything runs on your machine | Data sent to provider |
| Offline | Works fully offline | Requires internet |
| Model choice | Pull any Ollama-compatible model | Provider's model catalog |
| Experimentation | Instant, free, no rate limits | Metered, rate-limited |

**Trade-offs:** Local models (especially 0.5B–1.5B) produce lower-quality output than large cloud models. Ollama is a local inference service that downloads models to disk (~400 MB for 0.5B, ~1 GB for 1.5B). See [local-model.md](docs/local-model.md) for details.

---

## Use this template

### 1. GitHub template (recommended)

Click **"Use this template"** at the top of the [repository](https://github.com/amplitude/swarm) to create a new repo pre-populated with all files.

### 2. Manual fork / clone

```bash
git clone https://github.com/amplitude/swarm.git my-agent-app
cd my-agent-app
git remote rename origin upstream  # optional: keep origin for your own repo
```

### 3. Five-minute quickstart

```bash
# Install Ollama (local inference service)
curl -fsSL https://ollama.com/install.sh | sh

# Pull the default model (397 MB)
ollama pull qwen2.5-coder:0.5b

# Install dependencies and start
pnpm install
pnpm dev
```

Open **http://localhost:5173/swarm/** in your browser.

> You can replace `qwen2.5-coder:0.5b` with any Ollama model.  
> Try `qwen2.5-coder:1.5b` (986 MB) for better results, or `llama3.2:1b` (1.3 GB).

---

## What's included

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 |
| LLM (default) | Ollama (local, <=1.5B models) |
| LLM (expert) | WebLLM / WebGPU (>1.5B, manual only) |
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

## Customization map

### Agents
Edit `src/agents/` to add, remove, or modify agent personalities. Each agent has a system prompt, allowed tools, and handoff rules.

### Prompts
Agent system prompts live in `src/agents/prompts/`. Modify tone, capabilities, or add domain-specific instructions.

### Tools
Add or remove tools in `src/tools/definitions.ts`. Each tool defines its function schema and execution handler.

### UI
- Dashboard layout: `src/components/dashboard/MissionControl.tsx`
- Agent cards: `src/components/dashboard/AgentCard.tsx`
- Chat UI: `src/components/chat/`
- Theme / colors: `tailwind.config.ts` and `src/styles/globals.css`
- Icons: [Lucide React](https://lucide.dev/icons/) (bundled)

### Model configuration
- Default model: `src/llm/model-constants.ts` (`DEFAULT_MODEL`)
- Fallback model: same file (`FALLBACK_MAP`, `DEFAULT_FALLBACK_MODEL_ID`)
- Provider: `VITE_LLM_PROVIDER` env var or localStorage `swarm-provider`

### Branding
- App name / title: `index.html` (`<title>`)
- PWA manifest: `vite.config.ts` (`VitePWA` plugin options)
- Icon: Replace `public/icon-192.png` and `public/icon-512.png`

---

## Local-model fallback chain

The app auto-selects the absolute smallest model (`smollm2:135m`, ~96 MB) on first run. If that model fails to load (model not found, unsupported architecture, capability check failure), it escalates to `qwen2.5-coder:0.5b` (397 MB).

**This only escalates for model-specific failures.** Network errors, auth failures, user cancellation, or generic generation errors never trigger fallback.

Fallback map (from `src/llm/model-constants.ts`):

| Primary | Fallback |
|---------|----------|
| smollm2:135m (~96 MB) | qwen2.5-coder:0.5b (397 MB) |

There is **no automatic 1.5B path**. 1.5B+ models require explicit user selection.

To disable fallback, set a specific model ID via environment variable or localStorage — this bypasses the fallback chain entirely.

---

## Testing

```bash
# Full test suite (vitest, jsdom)
pnpm test:run

# Production build
pnpm build

# Geometry audit (requires build first + playwright)
node scripts/geometry-audit.mjs

# Blank-first-run E2E (requires build first)
node scripts/e2e-blank-first-run.mjs

# Live Ollama integration test (requires running Ollama)
RUN_LIVE_OLLAMA=1 pnpm test:run -- src/__tests__/llm/
```

---

## Deployment caveat

This app is designed for **local development and experimentation**. It is **not production-ready by default**:

**Checklist before considering production use:**

- [ ] **Security**: Add authentication and authorization. The app has none.
- [ ] **Persistence**: IndexedDB data is per-browser. Add a real backend for multi-device sync.
- [ ] **Model quality**: Local 0.5B–1.5B models produce unreliable output. Test thoroughly for your use case.
- [ ] **Licensing / branding**: Review all dependencies (MIT by default). Replace placeholder icons and names.
- [ ] **Rate limiting**: None exists. Add if exposing to untrusted users.
- [ ] **Error handling**: Basic error boundaries exist. Expand for production resilience.
- [ ] **Monitoring**: No telemetry or logging. Add your own observability.
- [ ] **CSP / CORS**: No Content Security Policy. Add one before deploying to a shared domain.

To build for deployment:

```bash
pnpm build
# Output in dist/ — serve with any static file server
# The app expects a base path of /swarm/ (configurable in vite.config.ts)
```

---

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `VITE_LLM_PROVIDER` | `ollama` | Inference provider: `ollama` or `webllm` |
| `VITE_OLLAMA_ENDPOINT` | `http://localhost:11434` | Ollama server URL |
| `VITE_LLM_MODEL` | `ollama/smollm2:135m` | Model ID (<=0.5B auto; WebLLM >1.5B requires explicit ID) |

Runtime settings (localStorage):
- `swarm-provider` — `"ollama"` or `"webllm"`
- `swarm-model-id` — model identifier
- `swarm-ollama-endpoint` — Ollama server URL

See [docs/local-model.md](docs/local-model.md) for detailed configuration.

---

## Requirements

- **Default (Ollama):** [Ollama](https://ollama.com) local service, any modern browser
- **WebLLM (expert):** Chrome 113+, Edge 113+, or WebGPU-enabled browser
- ~96 MB–5 GB disk/storage depending on model

---

## Documentation

- [Local Model Setup](docs/local-model.md) — Model selection, configuration, troubleshooting
- [System Architecture](docs/ARCHITECTURE.md)
- [Design System](docs/DESIGN-SYSTEM.md)
- [Model Compatibility](docs/MODEL-COMPATIBILITY.md)

---

## License

MIT — see [LICENSE](LICENSE).
