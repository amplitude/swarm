# Local Model Setup

Swarm supports two local inference runtimes. **Ollama is the default** — it's faster, uses tiny models (<=0.5B automatic, with smollm2:135m as the absolute smallest default), and works in any browser. WebLLM is an expert option for when you can't or don't want to run a separate process — all WebLLM models are >1.5B and require explicit user selection.

---

## Option 1: Ollama (Recommended)

[Ollama](https://ollama.com) runs a local inference service via a REST API. Default models are ~96–397 MB.

### Installation

```bash
# macOS
curl -fsSL https://ollama.com/install.sh | sh

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Docker
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama
```

### Default Model

| Model | Size (measured live) | Notes |
|-------|---------------------|-------|
| `smollm2:135m` | ~96 MB | **Smallest practical Ollama model.** Intentionally dumb — produces low-quality output, struggles with tool calls. Default for instant startup. |

Pull it:

```bash
ollama pull smollm2:135m
```

### Automatic Fallback Chain

If the primary model (smollm2:135m) fails to load, the app **automatically escalates** to qwen2.5-coder:0.5b. **There is no automatic 1.5B path.** The fallback triggers only for eligible failures:

| Eligible (triggers fallback) | NOT eligible (error propagates) |
|------------------------------|----------------------------------|
| Model-not-found (exact pattern match) | Network connection failure (ECONNREFUSED, Ollama unreachable) |
| Manifest-not-found (exact pattern match) | Auth/config errors (HTTP 401/403) |
| Unsupported architecture | User cancellation (AbortError) |
| App capability-check failure | Generic 5xx (HTTP 500, 502, 503) |
| — | Rate limiting (HTTP 429) |
| — | Malformed output / JSON parse errors |
| — | Arbitrary generation failures |

**Important:** The same Ollama endpoint being unreachable **never** triggers fallback.
Network failures and server errors propagate the original error rather than attempting
a larger model. Fallback only occurs for clearly model-specific signals where trying
the configured fallback can genuinely help.

The app surfaces which model is active and why fallback occurred via `getFallbackInfo()`. If you explicitly set a model via localStorage or env var, that choice takes priority and the fallback chain respects it.

See `src/llm/fallback-provider.ts` for implementation and tests.

### Other Available Models (manual selection only)

| Model | Size (measured live) | Notes |
|-------|---------------------|-------|
| `qwen2.5-coder:0.5b` | 397 MB | Smallest capable coder. Fast fallback from smollm2:135m. |
| `qwen2.5:0.5b` | 397 MB | Smallest general model. |
| `qwen2.5-coder:1.5b` | 986 MB | Better reasoning, manual selection required. Not auto-selected. |
| `llama3.2:1b` | 1.3 GB | Meta's smallest instruct model, manual selection required. |

### Switching Models

At runtime, set localStorage:

```js
// In browser console:
localStorage.setItem('swarm-model-id', 'ollama/qwen2.5-coder:0.5b');
```

Or via Vite env (restart required):

```bash
VITE_LLM_MODEL=ollama/qwen2.5-coder:0.5b pnpm dev
```

### Custom Ollama Endpoint

If Ollama runs on a different host or port:

```bash
VITE_OLLAMA_ENDPOINT=http://my-server:11434 pnpm dev
```

Or at runtime:

```js
localStorage.setItem('swarm-ollama-endpoint', 'http://192.168.1.100:11434');
// Then reload:
localStorage.removeItem('swarm-last-model');
```

### Troubleshooting

**"Cannot connect to Ollama"**
- Ensure Ollama is running: `ollama ps`
- Check the endpoint: `curl http://localhost:11434/api/tags`
- If using Docker, ensure port 11434 is exposed

**"Model not found"**
- Pull the model: `ollama pull smollm2:135m`
- Verify it's available: `ollama list`

**Slow responses**
- SmolLM2 135M should respond near-instantly. If not, check system resources.
- Try a lighter variant or check that Ollama isn't overloaded with other models

---

## Option 2: WebLLM (WebGPU — Expert, >1.5B models)

WebLLM runs models directly in the browser using WebGPU. No separate process needed, but requires a WebGPU-capable browser and a one-time model download.

**Important:** All WebLLM models exceed 1.5B parameters. There is no automatic WebLLM fallback — you must explicitly select a WebLLM model from the UI or config.

### Requirements

- Chrome 113+, Edge 113+, or another browser with WebGPU
- ~2–5 GB free storage for model weights
- GPU with sufficient VRAM (4 GB+ recommended)

### Models

| Model | Size (MLC estimate, unverified) | Notes |
|-------|-------------------------------|-------|
| `Qwen3-4B-q4f16_1-MLC` | ~3 GB | Lightweight and capable. Recommended for WebLLM. |
| `Qwen3-8B-q4f16_1-MLC` | ~5 GB | Best for agents but requires more resources. |

> Phi-3.5 Mini Instruct (3.8B, ~2 GB) is not listed as a default. It remains available via explicit model configuration.

### Switching to WebLLM

```bash
VITE_LLM_PROVIDER=webllm VITE_LLM_MODEL='Qwen3-4B-q4f16_1-MLC' pnpm dev
```

Or at runtime:

```js
localStorage.setItem('swarm-provider', 'webllm');
localStorage.setItem('swarm-model-id', 'Qwen3-4B-q4f16_1-MLC');
```

---

## Configuration Reference

All configuration is optional. Defaults work for local usage with Ollama.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_LLM_PROVIDER` | `ollama` | `ollama` or `webllm` |
| `VITE_OLLAMA_ENDPOINT` | `http://localhost:11434` | Ollama server URL |
| `VITE_LLM_MODEL` | `ollama/smollm2:135m` | Model identifier (Ollama <=0.5B default; WebLLM >1.5B, no default) |

### localStorage Keys

| Key | Type | Description |
|-----|------|-------------|
| `swarm-provider` | string | `ollama` or `webllm` |
| `swarm-model-id` | string | Model identifier (with `ollama/` prefix for Ollama models) |
| `swarm-ollama-endpoint` | string | Ollama server URL |
| `swarm-theme` | `dark` \| `light` | UI theme |
| `swarm-last-agent` | AgentType | Last active agent |
| `swarm-handoff-rules` | JSON | Handoff approval rules |

### Provider IDs

Ollama: `ollama/<name>`, e.g. `ollama/smollm2:135m`
WebLLM: MLC model ID, e.g. `Qwen3-4B-q4f16_1-MLC`

---

## Honest Limitations

- **Ollama requires a local inference service** — it's not "in-browser" inference. You need Ollama installed and running on your machine (or a reachable network host).
- **Small models have very limited reasoning** — The default 135M model produces unreliable, low-quality output. It cannot reliably format tool calls. Even the 0.5B fallback may struggle with complex multi-step tasks.
- **WebLLM requires WebGPU** — not available in Firefox or Safari. The app will show a warning banner.
- **No tool-calling guarantees** — Tool calling is text-based (JSON parsing from output). It works marginally with 0.5B models but the 135M default has `toolCallFormat: 'none'` and cannot perform tool calls.
- **No cloud inference** — There is no hosted backend or cloud model option. If you want one, configure an Ollama endpoint pointing at a remote server.
- **135M model is intentionally low-quality** — It exists solely for instant startup. For any real work, manually select a 0.5B+ model.

---

## Verification

To verify your setup:

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags
# Expected: {"models": [...]} with your pulled models listed

# Check a specific model (example)
curl http://localhost:11434/api/generate -d '{"model":"smollm2:135m","prompt":"hello","stream":false}'
# Expected: {"response": "Hello! ..."}
```

If both commands succeed, run `pnpm dev` in the project and open the browser.
