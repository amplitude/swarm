# Local Model Setup

Swarm supports two local inference runtimes. **Ollama is the default** — it's faster, uses tiny models, and works in any browser. WebLLM is the fallback for when you can't or don't want to run a separate process.

---

## Option 1: Ollama (Recommended)

[Ollama](https://ollama.com) runs models locally via a REST API. Models are ~500 MB to ~1 GB — much smaller than WebLLM models.

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

| Model | Size | Notes |
|-------|------|-------|
| `qwen2.5-coder:0.5b` | ~750 MB | Fastest capable coder model. Default. |

Pull it:

```bash
ollama pull qwen2.5-coder:0.5b
```

### Other Recommended Models

| Model | Size | Notes |
|-------|------|-------|
| `qwen2.5-coder:1.5b` | ~1 GB | Better reasoning than 0.5B. Good balance. |
| `llama3.2:1b` | ~800 MB | Meta's smallest instruct model. |
| `qwen2.5:0.5b` | ~500 MB | Smallest general purpose model. |

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
- Try a smaller model: `ollama/qwen2.5:0.5b` (~500 MB)
- Check system resources: Ollama runs on CPU by default, GPU acceleration may help

---

## Option 2: WebLLM (WebGPU Fallback)

WebLLM runs models directly in the browser using WebGPU. No separate process needed, but requires a WebGPU-capable browser and a one-time model download.

### Requirements

- Chrome 113+, Edge 113+, or another browser with WebGPU
- ~2–5 GB free storage for model weights
- GPU with sufficient VRAM (4 GB+ recommended)

### Models

| Model | Size | Notes |
|-------|------|-------|
| `Phi-3.5-mini-instruct-q4f16_1-MLC` | ~2 GB | Smallest WebLLM model. Recommended fallback. |
| `Qwen3-4B-q4f16_1-MLC` | ~3 GB | Lightweight and capable. |
| `Qwen3-8B-q4f16_1-MLC` | ~5 GB | Best for agents but requires more resources. |

### Switching to WebLLM

```bash
VITE_LLM_PROVIDER=webllm VITE_LLM_MODEL=Phi-3.5-mini-instruct-q4f16_1-MLC pnpm dev
```

Or at runtime:

```js
localStorage.setItem('swarm-provider', 'webllm');
localStorage.setItem('swarm-model-id', 'Phi-3.5-mini-instruct-q4f16_1-MLC');
```

---

## Configuration Reference

All configuration is optional. Defaults work for local usage with Ollama.

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `VITE_LLM_PROVIDER` | `ollama` | `ollama` or `webllm` |
| `VITE_OLLAMA_ENDPOINT` | `http://localhost:11434` | Ollama server URL |
| `VITE_LLM_MODEL` | `ollama/qwen2.5-coder:0.5b` | Model identifier |

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
WebLLM: MLC model ID, e.g. `Phi-3.5-mini-instruct-q4f16_1-MLC`

---

## Honest Limitations

- **Ollama relies on a local process** — it's not "in-browser" inference. You need Ollama installed and running.
- **Small models have limited reasoning** — 0.5B parameter models may struggle with complex multi-step tasks.
- **WebLLM requires WebGPU** — not available in Firefox or Safari. The app will show a warning banner.
- **No tool-calling guarantees** — Tool calling is text-based (JSON parsing from output). It works well with most models but is not as reliable as native function calling.
- **No cloud inference** — There is no cloud model option. If you want one, configure an Ollama endpoint pointing at a remote server.
- **Tool calling with 0.5B models** — The smallest models may not reliably format tool calls. If you encounter issues, try `ollama/llama3.2:1b` or `ollama/qwen2.5-coder:1.5b`.

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
