# Swarm

A fully client-side, offline-capable agentic web app powered by local LLMs.

**No cloud backend. No API keys. No telemetry.** Just your browser and a local Ollama service.

## Quickstart

### Option 1: Ollama (recommended — fast, small, local service)

```bash
# 1. Install Ollama (local inference service)
curl -fsSL https://ollama.com/install.sh | sh

# 2. Pull the default model (actual size: 397 MB)
ollama pull qwen2.5-coder:0.5b

# 3. Start the app
pnpm install
pnpm dev
```

Open http://localhost:5173/swarm/ in your browser.

### Option 2: WebLLM (browser-native via WebGPU)

Requires Chrome 113+ or Edge 113+ with WebGPU support. All WebLLM models exceed 1.5B parameters and require explicit user selection — there is no automatic WebLLM fallback.

```bash
pnpm install
pnpm dev
```

On first run, you'll be prompted to download a model (~2–5 GB). This is a one-time download cached in your browser.

## Configuration

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `VITE_LLM_PROVIDER` | `ollama` | Inference provider: `ollama` or `webllm` |
| `VITE_OLLAMA_ENDPOINT` | `http://localhost:11434` | Ollama server URL |
| `VITE_LLM_MODEL` | `ollama/qwen2.5-coder:0.5b` | Model ID to use (default <=1.5B; WebLLM models >1.5B require explicit ID) |

Settings can also be changed at runtime via localStorage:
- `swarm-provider` — "ollama" or "webllm"
- `swarm-model-id` — model identifier
- `swarm-ollama-endpoint` — Ollama server URL

See [docs/local-model.md](docs/local-model.md) for detailed configuration.

## What is this?

Swarm is a browser-based AI agent team platform. Multiple specialized AI agents collaborate on tasks — all running entirely in your browser:

- **Coder** — Generates and executes JavaScript in a sandboxed environment
- **PM** — Manages tasks, breaks down work, writes specs and plans
- **Designer** — Creates Mermaid diagrams and visual designs
- **General** — Open-ended chat with toggleable tools
- **Manager** — Routes tasks to the right specialist agent

### Key Features

- **Truly offline** — No telemetry, no cloud backend, no data leaves your device
- **Local model inference** — Via Ollama (default, lightweight local service) or WebLLM/WebGPU (browser-native)
- **Agent handoffs** — Agents can delegate tasks to each other
- **Sandboxed code execution** — Iframe sandbox + QuickJS WASM
- **Mermaid diagram rendering** — From natural language
- **Persistent state** — Via IndexedDB (survives browser restarts)

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite 6 |
| Styling | Tailwind CSS 4 |
| LLM (default) | Ollama (local service, lightweight <=1.5B models) |
| LLM (expert) | @mlc-ai/web-llm via WebGPU (>1.5B, manually selected) |
| State | Zustand (memory) + Dexie.js/IndexedDB (persistence) |
| Code Sandbox | iframe sandbox + QuickJS WASM |
| Diagrams | Mermaid.js |
| Offline | Service Worker via Vite PWA plugin |

## Requirements

- **Default (Ollama):** [Ollama](https://ollama.com) local service, any modern browser
- **WebLLM (expert):** Chrome 113+, Edge 113+, or WebGPU-enabled browser (models >1.5B)
- ~400 MB–5 GB disk/storage depending on model

## Documentation

- [Local Model Setup](docs/local-model.md) — Model selection, configuration, troubleshooting
- [Product Requirements (PRD)](docs/PRD.md)
- [System Architecture](docs/ARCHITECTURE.md)
- [Model Compatibility](docs/MODEL-COMPATIBILITY.md)

## License

MIT
