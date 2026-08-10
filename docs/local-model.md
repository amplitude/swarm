# Local Model Setup

Swarm supports two local inference runtimes. **Ollama is the default** — it's faster, uses tiny models (<=1.5B parameters, all verified with live smoke tests), and works in any browser. WebLLM is an expert option for when you can't or don't want to run a separate process — all WebLLM models are >1.5B and require explicit user selection.

---

## Option 1: Ollama (Recommended)

[Ollama](https://ollama.com) runs a local inference service via a REST API. Models range from ~397 MB to ~1.3 GB — much smaller than WebLLM models.

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
| `qwen2.5-coder:0.5b` | 397 MB | Fastest capable coder model. Default. Live-tested 2026-08-10 (Q4_K_M, 494M params, Ollama v0.32.7). |

Pull it:

```bash
ollama pull qwen2.5-coder:0.5b
```

### Other Recommended Models

| Model | Size (measured live) | Notes |
|-------|---------------------|-------|
| `qwen2.5-coder:1.5b` | 986 MB | Better reasoning than 0.5B. Good balance (live-tested, Q4_K_M, 1.5B params). |
| `llama3.2:1b` | 1.3 GB | Meta's smallest instruct model (Q8_0 quantization; larger disk than Q4 variants). |
| `qwen2.5:0.5b` | 397 MB | Smallest general purpose model (live-tested, Q4_K_M, 494M params). |

### Switching Models

At runtime, set localStorage:

```js
// In browser console:
localStorage.setItem('swarm-model-id', 'ollama/llama3.2:1b');
```

Or via Vite env (restart required):

```bash
VITE_LLM_MODEL=ollama/llama3.2:1b pnpm dev
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
- Pull the model: `ollama pull qwen2.5-coder:0.5b`
- Verify it's available: `ollama list`

**Slow responses**
- Try a smaller model: `ollama/qwen2.5:0.5b` (397 MB)
- Check system resources: Ollama runs on CPU by default, GPU acceleration may help

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

> Phi-3.5 Mini Instruct (3.8B, ~2 GB) is no longer listed as a default — all automatic defaults are <=1.5B. It remains available via explicit model configuration.

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
| `VITE_LLM_MODEL` | `ollama/qwen2.5-coder:0.5b` | Model identifier (Ollama <=1.5B default; WebLLM >1.5B, no default) |

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

Ollama: `ollama/<name>`, e.g. `ollama/qwen2.5-coder:0.5b`
WebLLM: MLC model ID, e.g. `Qwen3-4B-q4f16_1-MLC`

---

## Honest Limitations

- **Ollama requires a local inference service** — it's not "in-browser" inference. You need Ollama installed and running on your machine (or a reachable network host).
- **Small models have limited reasoning** — 0.5B parameter models may struggle with complex multi-step tasks. Live testing confirms basic JSON tool calling works but complex chains may fail.
- **WebLLM requires WebGPU** — not available in Firefox or Safari. The app will show a warning banner.
- **No tool-calling guarantees** — Tool calling is text-based (JSON parsing from output). It works well with most models but is not as reliable as native function calling.
- **No cloud inference** — There is no hosted backend or cloud model option. If you want one, configure an Ollama endpoint pointing at a remote server.
- **Tool calling with 0.5B models** — The smallest models may not reliably format tool calls. Live testing confirms basic JSON tool calling works. If you encounter issues, try `ollama/qwen2.5-coder:1.5b` (986 MB, 1.5B params).

---

## Verification

To verify your setup:

```bash
# Check Ollama is running
curl http://localhost:11434/api/tags
# Expected: {"models": [...]} with your pulled models listed

# Check a specific model (example)
curl http://localhost:11434/api/generate -d '{"model":"qwen2.5-coder:0.5b","prompt":"hello","stream":false}'
# Expected: {"response": "Hello! ..."}
```

If both commands succeed, run `pnpm dev` in the project and open the browser.
