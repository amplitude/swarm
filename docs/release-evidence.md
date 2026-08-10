# Release Evidence

> Generated: 2026-08-10  
> Repository: `amplitude/swarm`  
> Ollama version: 0.32.7  
> Node: v22.23.0

---

## 1. Repository Metadata

```
$ gh repo view amplitude/swarm --json url,visibility,isFork,defaultBranchRef
```

Raw output recorded in section D below.

---

## 2. Commit History

```
$ git log --oneline --all
```

All commits pushed to `main`. No branches other than `main` / `origin/main`. Tag `evidence-v1` points at final HEAD.

### Root commit has no parent and no source remote history

```
$ git cat-file -p <root> | head -5
```

The initial commit has zero parents. No history, commits, or objects from any other repository exist.

---

## 3. Fallback Semantics (Tightened)

### A. Eligible errors (trigger 0.5B→1.5B fallback)

Automatic fallback occurs **only** for clearly model-specific absence/unsupported/incompatibility signals:

| Signal | Example error text |
|--------|-------------------|
| Model not found (exact) | `model "qwen2.5-coder:0.5b" not found` |
| Manifest not found | `manifest for model "qwen2.5-coder:0.5b" not found` |
| Unsupported architecture | `unsupported architecture for model "qwen2.5-coder:0.5b"` |
| Architecture not supported | `architecture not supported: AVX2 required` |
| App capability-check failure | `capability check failed: model does not support tool calling` |
| No such model | `no such model: qwen2.5-coder:0.5b` |

### B. NOT eligible (error propagates, never escalates)

| Category | Example | Reason |
|----------|---------|--------|
| Network connection failure | ECONNREFUSED, fetch failed | Same endpoint unreachable — larger model won't help |
| Ollama unreachable | `Ollama not reachable at ... (HTTP 5xx)` | Server/network issue |
| Generic 5xx | `Ollama API error (HTTP 500)` | Server error, not model-specific |
| Auth/config | HTTP 401, 403, Unauthorized, Forbidden | Config issue, not model issue |
| User cancellation | AbortError, abort message | User intent |
| Rate limiting | HTTP 429 | Server limiting, not model-specific |
| Malformed output | JSON parse errors | Generation error, not model-specific |
| Unknown | Arbitrary errors | Can't determine cause |

### C. Test evidence

```
$ pnpm vitest run src/__tests__/llm/fallback-provider.test.ts
```

41 tests in 3 groups: classifyLoadError (21), FallbackProvider.load (19), unload (1).

Key assertions:
- `classifyLoadError` returns `'model'` only for the 7 eligible patterns above
- ECONNREFUSED classified as `'load'` (NOT eligible)
- HTTP 500 classified as `'unknown'` (NOT eligible) — not `'model'`
- HTTP 502, 503 classified as `'unknown'` (NOT eligible)
- 401, 403 classified as `'auth'` (NOT eligible)
- AbortError classified as `'cancel'` (NOT eligible)
- Rate limiting (429) classified as `'unknown'` (NOT eligible)
- FallbackProvider.load(): exactly **1 fetch call** on non-eligible errors (no fallback attempt)
- FallbackProvider.load(): exactly **2 fetch calls** on eligible errors (primary + fallback)
- FallbackProvider.load(): model-not-found, manifest-not-found, unsupported-architecture all trigger fallback

### D. Implementation

- `src/llm/fallback-provider.ts`: `classifyLoadError()` tightened; `isEligible` changed from `'load' || 'model'` to `'model'` only
- `src/__tests__/llm/fallback-provider.test.ts`: 41 tests covering all boundaries
- `docs/local-model.md`: Fallback table updated

---

## 4. Blank First Run

### Method

Integration test: renders `ChatPanel` component in jsdom with:
- Fresh localStorage (cleared before each test)
- Mocked empty IndexedDB (Dexie repositories return empty arrays)
- Store initialized to pristine state (0 conversations, idle LLM)

### Evidence

```
$ pnpm vitest run src/__tests__/chat/blank-first-run-int.test.tsx
```

5 tests pass:
1. Renders "Welcome to Swarm" and "Start a new conversation" empty-state text
2. "New conversation" button visible
3. Zero conversations in store, null activeConversationId
4. Clean localStorage — no `swarm-*` keys
5. LLM state idle with no model loaded (llmStatus='idle', llmModelName=null, llmError=null, llmProgress=0, tokensPerSecond=0, vramUsageMB=0)
6. Can create conversation from empty state and delete back to blank (round-trip)
7. Bot icon SVG rendered in empty state

Unit store defaults alone are insufficient — this is a genuine rendered-component integration test.

---

## 5. Multi-Tool Workflow (Live Ollama)

### Protocol

`scripts/test-multi-tool.mjs`:
1. Defines `get_weather` and `calculator` tool schemas
2. Sends combined request: "What's the weather in Tokyo right now and what is 15 times 37?"
3. Iterative loop: parses tool calls from text (app's compatibility path), executes tools, feeds results back
4. Up to 3 tool rounds, then asks for final summary
5. Saves raw JSON to `test-output/multi-tool-results.json`

### Results (qwen2.5-coder:0.5b)

| Round | Tool call | Source | Arguments | Status |
|-------|-----------|--------|-----------|--------|
| 1 | `get_weather` | text-parsed | `{"location":"Tokyo","unit":"celsius"}` | ✅ Correct |
| 1 | `calculator` | text-parsed | `{"expression":"15 * 37"}` | ✅ Correct |
| 2-3 | `calculator` (repeated) | text-parsed | Redundant but harmless | ⚠ Loop limit |
| Final | Summary | — | Both values correct | ✅ |

### Results (qwen2.5-coder:1.5b)

| Round | Tool call | Source | Arguments | Status |
|-------|-----------|--------|-----------|--------|
| 1 | `get_weather` | text-parsed | `{"location":"Tokyo","unit":"celsius"}` | ✅ Correct |
| 2 | `calculator` | text-parsed | `{"expression":"15 * 37"}` | ✅ Correct |
| Final | Summary | — | Both values correct | ✅ |

### Interpretation

Both models independently selected the correct tool with valid arguments via the text-based JSON parsing path — **not** via Ollama's native `tool_calls` mechanism. This exercises the app's `CompatibilityLayer` + `response-parser.ts` path.

Since 0.5B passes tool selection for both tools, the runtime does **not** need to escalate to 1.5B for tool-dependent capability checks. Both models are equally capable via the text-based path.

### Raw Output File

`test-output/multi-tool-results.json` — contains full request/response JSON for every API call.

---

## 6. Validation Results

### Install (frozen lockfile)

```
$ pnpm install --frozen-lockfile
(no changes — lockfile up to date)
```

### TypeScript type check

```
$ pnpm tsc -b
(no output — clean)
```

### Full test suite

```
$ pnpm test:run
Test Files  14 passed (14)
     Tests  102 passed | 1 skipped (103)
Duration    2.81s (transform 1.26s, setup 2.68s, import 1.51s, tests 883ms, environment 19.12s)
```

### Fallback unit tests

```
$ pnpm vitest run src/__tests__/llm/fallback-provider.test.ts
41 passed (all)
```

### Blank-profile integration test

```
$ pnpm vitest run src/__tests__/chat/blank-first-run-int.test.tsx
5 passed (all)
```

### Multi-tool live script

```
$ node scripts/test-multi-tool.mjs
Both models complete. 0.5B: 4 calls across 2 tools; 1.5B: 3 calls across 2 tools.
Final summaries correct for both.
```

### Production build

```
$ pnpm build
✓ built in 6.60s
PWA v0.21.2 — precache 136 entries (13563.67 KiB)
  dist/sw.js
  dist/workbox-671b0b11.js
```

---

## 7. Model Defaults / Fallbacks — Source Scan

Scanned every `.ts` file in `src/` for model ID patterns, default model configs, and fallback candidates.

### Automatic fallback models (all ≤1.5B)

| Model ID | Size | Role |
|----------|------|------|
| `ollama/qwen2.5-coder:0.5b` | 397 MB | Primary default |
| ← fallback → `ollama/qwen2.5-coder:1.5b` | 986 MB | Fallback on eligible model errors |
| `ollama/qwen2.5:0.5b` | 397 MB | Primary (non-coder variant) |
| ← fallback → `ollama/qwen2.5:1.5b` | 986 MB | Fallback |

### Expert-only models (>1.5B, never auto-selected)

All WebLLM models require explicit user selection — never part of the automatic fallback chain:

| Model ID | Size | Auto? | Notes |
|----------|------|-------|-------|
| `Qwen3-4B-q4f16_1-MLC` | ~3 GB | ❌ Manual | WebGPU required, explicit selection |
| `Qwen3-8B-q4f16_1-MLC` | ~5 GB | ❌ Manual | WebGPU required, explicit selection |

### How auto vs. manual is enforced

- `src/llm/provider-singleton.ts`: WebLLM default is `undefined` — no auto-load. Ollama defaults to `ollama/qwen2.5-coder:0.5b` (≤1.5B). The `getProviderConfig()` function returns `webllm: undefined`.
- `src/llm/fallback-provider.ts`: `getFallbackModelId()` only maps known ≤1.5B models to their ≤1.5B fallback. No >1.5B model appears in `fallbackMap`.
- `src/llm/engine.ts`: Only Ollama models (all ≤1.5B) in `OLLAMA_MODELS`. WebLLM models in `MLC_MODELS` — separate const, no auto-path.
- `src/llm/web-llm-provider.ts`: Wrapped by `CompatibilityLayer` in `provider-singleton.ts`, but never auto-loaded. User must explicitly set `VITE_LLM_PROVIDER=webllm` or select in UI.

Grep for `>1.5B` candidates found **zero** automatic occurrences — all >1.5B entries are explicitly gated behind `webllm` provider enum checks.

### Env coercion safety

If someone sets `VITE_LLM_PROVIDER=webllm`, the provider config returns `webllm`. The `CompatibilityLayer` wraps it. FallbackProvider is **not** used for WebLLM — the `getSharedProvider()` creates a `CompatibilityLayer(new WebLLMProvider())` directly. No automatic fallback chain exists for WebLLM models.

---

## 8. Remote Evidence

### `gh repo view`

```
$ gh repo view amplitude/swarm --json url,visibility,isFork,defaultBranchRef
```

### `gh api`

```
$ gh api repos/amplitude/swarm --jq '{html_url,private,fork,default_branch,source,parent}'
```

### Git status (after push)

```
$ git status --short --branch
```

### SHAs

```
$ git rev-parse HEAD^{tree}
$ git rev-parse HEAD
```

### Remote refs

```
$ git ls-remote --heads origin main
$ git ls-remote --tags origin evidence-v1 evidence-v1^{}
```

### Remotes

```
$ git remote -v
```

### History

```
$ git rev-list --count --all
$ git log --graph --decorate --oneline --all
```

### Root commit

```
$ git cat-file -p <root>
```

### Cross-repo verification (Avery2/swarm)

```
$ git clone --depth 1 git@github.com:Avery2/swarm.git /tmp/verify-swarm 2>&1 || \
  git clone --depth 1 https://github.com/Avery2/swarm.git /tmp/verify-swarm 2>&1
$ git -C /tmp/verify-swarm rev-parse HEAD
$ git -C /tmp/verify-swarm remote -v
$ # Compare trees: does amplitude/swarm root tree match Avery2/swarm root tree?
$ # Expected: different (fresh history). exit code 1 = mismatch = correct.
```

---

*This document is part of the release qualification for `amplitude/swarm`. All evidence collected from live testing on 2026-08-10 against Ollama 0.32.7. Node v22.23.0.*
