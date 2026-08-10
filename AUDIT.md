# Swarm — Source & Architecture Audit

**DEST_PATH:** `/Users/averychan/Documents/amp/swarm`
**Audit Date:** 2026-08-10
**Source:** https://github.com/Avery2/swarm (shallow clone, depth 1)
**Repository Status:** Authored by user as original author; copied without Git history or personal attribution per authorization.

---

## 1. Framework / Runtime / Package Manager

| Dimension           | Finding |
|---------------------|---------|
| **Framework**       | React 18.3 (SPA, hooks-based, no React Router) |
| **Language**        | TypeScript ~5.7 (strict mode, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`) |
| **Build Tool**      | Vite 6.4, `@vitejs/plugin-react` |
| **Styling**         | Tailwind CSS 4.1 (via `@tailwindcss/vite` plugin), shadcn/ui-style design tokens |
| **Package Manager** | pnpm 10.33 (lockfile: `pnpm-lock.yaml`, 8,582 lines) |
| **PWA**             | Vite PWA plugin 0.21 (service worker via Workbox, `generateSW` mode) |
| **Linting**         | No ESLint or Prettier config found. The single `eslint-disable` comment in `quickjs-sandbox.ts` references `@typescript-eslint/no-explicit-any` but no eslintrc/package.json eslint dep. |
| **PostCSS**         | Not used — Tailwind v4 is integrated as a Vite plugin (no separate config) |

### Runtime (Build Environment)

| Metric | Value |
|--------|-------|
| **node** | v22.23.0 |
| **pnpm** | 10.33.0 |
| **Python** | 3.9.6 (macOS) |
| **npm** | 10.33.0 (bundled) |
| **OS** | macOS (Darwin) |
| **Build time** | 6.32 s |
| **Test time** | 1.12 s |
| **TypeScript type-check** | Passed (exit 0, `tsc --noEmit`) |

### Install & Build Footprint

| Item | Size |
|------|------|
| Source code (137 files) | 1.0 MB |
| `node_modules` (installed) | 614 MB |
| `dist/` (build output, 141 files) | 18 MB |
| **Total working directory** | ~633 MB |
| **pnpm-lock.yaml** | 349 KB |

---

## 2. Model Setup & Download Size

### Recommended Models (from `src/llm/engine.ts`)

| Model ID | Size | Notes |
|----------|------|-------|
| `Qwen3-8B-q4f16_1-MLC` | ~5 GB | Best for agents, strong tool use |
| `Qwen3-4B-q4f16_1-MLC` | ~3 GB | Lightweight, good tool calling |
| `Hermes-3-Llama-3.1-8B-q4f16_1-MLC` | ~4 GB | Native function calling, fallback |
| `Hermes-2-Pro-Llama-3-8B-q4f16_1-MLC` | ~4 GB | Native f/n calling, best OSS FC |
| `Llama-3.1-8B-Instruct-q4f16_1-MLC` | ~4 GB | General purpose |
| `Phi-3.5-mini-instruct-q4f16_1-MLC` | ~2 GB | Smallest/fastest |

**First-run download:** 2–5 GB depending on model. Cached via browser Cache API after first download. Requires `navigator.storage.persist()` (implemented as `requestPersistentStorage` in `src/db/schema.ts`). App auto-loads previous model if cached; otherwise shows a download overlay with progress.

### Inference Runtime

`@mlc-ai/web-llm` (v0.2.78) using WebGPU. Runs in-browser via MLC's compiled WebGPU shaders. No server, no API keys required. The app includes a `CompatibilityLayer` decorator (decorator pattern) around `WebLLMProvider` that handles text-based tool calling (primary path) and falls back to native Hermes function calling on failure (auto-downgrade after 3 failures per session).

### WebGPU Requirement

Strict requirement. The app performs an early check (`checkWebGPUSupport()`) and shows a dismissible warning banner if absent. No WASM fallback is implemented despite docs mentioning a future `@huggingface/transformers` fallback — the `transformers-provider.ts` path listed in ARCHITECTURE.md does not exist as a file.

---

## 3. Local-Agent Behavior

### Architecture

The orchestrator (`src/agents/orchestrator.ts`) is a **custom lightweight agentic framework** (~600 lines). Design philosophy (stated in docs): avoid heavy server-side agent frameworks (LangChain.js, LlamaIndex.TS) in favor of a simple `Observe-Think-Act` loop.

### Agents

| Agent | ID | Skills | Tools | Handoff Target(s) |
|-------|----|--------|-------|-------------------|
| Coder | `coder` | code-generation, code-review, debugging, refactoring | run-javascript, preview-html, search-code, create-file, edit-file | PM, Designer |
| PM | `pm` | task-breakdown, requirements-analysis, roadmap-planning | create-task, render-mermaid | Coder, Designer |
| Designer | `designer` | ui-mockup, diagram-creation, design-review | render-mermaid, render-excalidraw | Coder, PM |
| General | `general` | summarization, brainstorming, research | web-search, +all creative tools | All |

### Handoff System

Human-in-the-loop handoff via `handoff_to_agent` tool. When an agent proposes a handoff, the loop **stops** and presents an approval widget in the UI with three tiers: "once", "route", and "all" (handoff approval scope). Rejection returns control to the current agent with a system-level rejection message. Manual agent switching (Cmd+1..5) is also supported.

### Tool System

Central registry (`src/tools/registry.ts`). Each tool declares JSON Schema parameters, executes via `ToolExecutor` (real or mock). Mock executor available in `src/tools/mock-executor.ts` for testing.

### Execution Isolation

**Two-layer sandbox architecture:**
1. **QuickJS WASM** (`quickjs-emscripten` v0.32) — for pure JS execution. True isolation: no DOM, network, or browser API access. ~500 KB WASM binary. Lazy-loaded on first execution.
2. **iframe sandbox** — for HTML/CSS preview. `sandbox="allow-scripts"` + CSP `default-src 'none'`. Destroyed and recreated on timeout (5s default).

Selection is automatic: if code contains DOM/HTML patterns, it routes to iframe; otherwise QuickJS.

**Notable: quickjs-emscripten does not support async/Promise execution.** This is by design but means all sandboxed code must be synchronous. The sandbox manager routes to iframe for any code containing `async` or `Promise` patterns? — No, the DOM/HTML pattern check is the only heuristic. Async JS code sent to QuickJS would fail silently.

### Persistence

| Layer | Technology |
|-------|-----------|
| In-memory state | Zustand (~5 slices) |
| Persistent storage | IndexedDB via Dexie.js (v4) |
| Schema version | v2 (added `creatorAgent` field to artifacts) |
| DB name | `AgenticWebApp` |
| Cache storage | Browser Cache API for model weights (via web-llm) |

Write-through: every message is immediately persisted to IndexedDB. No sync or conflict resolution needed (fully offline).

---

## 4. Tests / Build

### Test Results

```
Test Files  8 passed (8)
     Tests  19 passed | 1 skipped (20)
  Duration  1.12s (transform 572ms, setup 644ms, import 632ms, tests 120ms, environment 5.62s)
```

**All 8 test suites pass.** The one skipped test status is normal (likely a pending implementation).

### Test Suites

| File | Tests |
|------|-------|
| `agents/manager.test.ts` | Manager agent |
| `agents/orchestrator.test.ts` | Orchestrator flow |
| `boot/registries.test.ts` | Tool/skill registries |
| `chat/chat-flow.test.ts` | Chat flow |
| `dashboard/activity-feed.test.ts` | Dashboard |
| `llm/model-loading.test.ts` | Model loading |
| `store/conversation.test.ts` | Store |
| `ui/theme.test.ts` | Theme |

### Build Output

| Chunk | Size (raw) | Size (gzip) |
|-------|-----------|-------------|
| `index-Bkagi652.js` (main) | **6,765.68 kB** | 2,375.94 kB |
| `subset-shared.chunk-50-CHCgb.js` | 1,823.54 kB | 736.87 kB |
| `percentages-BXMCSKIN-B7LIRrng.js` | 1,149.20 kB | 376.09 kB |
| `mermaid.core-CNBk73NA.js` | 496.19 kB | 138.41 kB |
| `cytoscape.esm-BQaXIfA_.js` | 442.44 kB | 141.91 kB |
| 131 other assets | ~1.5 MB | ~400 kB |
| **Precached total** | **~13.7 MB** | ~4.5 MB |

**⚠ Build warning:** Several chunks exceed 500 kB. Main chunk at 6.7 MB is very large for a PWA — initial load (even cached) will be slow on low-end devices. Vite's `build.chunkSizeWarningLimit` is at default (500 kB).

### PWA Readiness

Service worker generated with 135 precached entries (13.7 MB raw). Has runtime caching for JS chunks (`CacheFirst`, 50 entry limit, 30-day expiry). **But PWA manifest icons are an empty array** (`icons: []` in `vite.config.ts`). This means: no app icon, no splash screen, no install prompt badge. The PWA installs but presents as a generic icon.

### TypeScript Health

- Strict mode enabled with `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`
- `tsc --noEmit` passes cleanly (exit 0)
- Test files excluded from tsconfig compilation but covered by vitest

---

## 5. Licenses / Notices / Dependency Obligations

### Project License

**None.** No `LICENSE` file exists. `README.md` says "License: TBD". This is a blocking issue for any redistribution.

### Key Dependency Licenses

| Dependency | License | Notes |
|-----------|---------|-------|
| `@mlc-ai/web-llm` | **Apache 2.0** | LLM inference engine |
| `quickjs-emscripten` | **MIT** | JS sandbox (copyright Jake Teton-Landis) |
| `dexie` | **Apache 2.0** | IndexedDB wrapper |
| `tailwindcss` | **MIT** | CSS framework |
| `lucide-react` | **ISC** | Icon library |
| `posthog-js` | **Apache 2.0** | Telemetry SDK |
| `mermaid` | **MIT** | Diagram rendering |
| `zustand` | **MIT** | State management |
| `react`, `react-dom` | **MIT** | UI framework |
| `@excalidraw/excalidraw` | **MIT** | Drawing component |
| `monaco-editor` | **MIT** | Code editor |
| `vite` | **MIT** | Build tool |

### Dependency Obligations

- **Apache 2.0 deps** (web-llm, dexie, posthog-js): require NOTICE file preservation if any bundled NOTICE exists. None of these ship with NOTICE files in their npm packages (verified), so no additional attribution beyond the standard Apache 2.0 notice is required.
- **MIT/ISC deps**: require copyright notice + permission notice in distributions. Standard MIT attribution is sufficient.
- **No third-party NOTICE or THIRD-PARTY file** exists in source. Would need to be generated for any distributed build.

### Vulnerability Audit

**91 vulnerabilities detected** (1 critical, 34 high, 48 moderate, 8 low).

| Severity | Package | Path | Issue |
|----------|---------|------|-------|
| **Critical** | protobufjs <7.5.5 | `posthog-js > @opentelemetry/... > protobufjs` | Arbitrary code execution |
| High | picomatch <2.3.2 | `vite > sass > chokidar > anymatch > picomatch` | ReDoS |
| High | picomatch <4.0.4 | `vite > picomatch` | ReDoS |
| Low | undici <7.28.0 | `jsdom > undici` | HTTP queue poisoning |
| Low | mermaid <11.16.1 | direct dep | Prototype pollution via config APIs |

The critical vuln is in a transitive dependency of PostHog's telemetry SDK. The pnpm overrides address other packages (serialize-javascript, dompurify, nanoid) but do **not** address the protobufjs or picomatch issues.

---

## 6. Secrets / Telemetry / Branding

### Telemetry: PostHog (Present)

PostHog is deeply integrated:

| File | Usage |
|------|-------|
| `src/main.tsx` | Wraps React root in `PostHogProvider` |
| `src/utils/llm-analytics.ts` | Captures `$ai_generation`, `$ai_trace`, `$ai_tool_call` events |
| `src/hooks/useLLM.ts` | Captures `model_loaded` event |
| `src/hooks/use-chat.ts` | Captures `message_sent` event |
| `src/store/app-store.ts` | Captures `agent_switched` event |
| `src/components/chat/HandoffApproval.tsx` | Captures handoff approval/rejection events |

**PostHog is configured via environment variables:**

```env
VITE_PUBLIC_POSTHOG_KEY=
VITE_PUBLIC_POSTHOG_HOST=
```

Both are empty in `.env.example`. If these are set, every agent conversation, tool call, and event is transmitted to PostHog. Since the app advertises "no servers, no API keys, no costs" and "fully offline", the presence of telemetry is a **contradiction to the stated value proposition** unless explicitly disabled.

**Recommendation:** Either remove PostHog entirely (to match the offline/privacy promise) or make it opt-in with clear disclosure.

### Secrets

- **No API keys, passwords, tokens, or credentials found in source.**
- The `.env.example` contains only PostHog config stubs (no values).
- The grep hit for "secret" in `task-breakdown.ts` is a false positive — it's an example prompt about building a form with "email and password fields".
- No `.env` or `.env.local` files are tracked.

### Branding

- App title: "Swarm - Agentic AI Chat" (in `index.html` and PWA manifest)
- No external branding or attribution to the original source repository
- No third-party logos or trademarks embedded
- README mentions the old project folder name `test-ai-chat-web-llm` — stale reference
- PWA manifest has **no icons** (empty array)

---

## 7. LFS / Submodules

| Feature | Status |
|---------|--------|
| Git LFS | Not used |
| Submodules | None |
| Binary assets | No large tracked files |

All model weights are downloaded at runtime by web-llm (browser Cache API), not stored in the repository. The only WASM binaries are `quickjs-emscripten` (loaded from npm, ~500 KB, lazy-loaded).

---

## 8. Obvious UX / Code Issues

### Critical Issues

1. **No LICENSE file.** `README.md` says "License: TBD". The project cannot be distributed or forked without a license. Recommend MIT or Apache 2.0.

2. **PostHog telemetry contradicts "fully offline" and "no servers" claims.** The app sends analytics data (conversation metadata, model usage, tool calls, errors) to PostHog when keys are configured. This should be either removed or made opt-in with a prominent privacy notice.

3. **PWA manifest has no icons** (`icons: []` in `vite.config.ts`). The app registers as a PWA and precaches 13.7 MB of assets, but has no install icon, splash screen, or badge. This is likely an oversight.

### High-Severity Issues

4. **Unpin transitive dependency vulnerabilities.** 91 vulns found including 1 critical (protobufjs via PostHog). The `pnpm.overrides` in `package.json` cover serialization/mermaid/nanoid but leave PostHog's telemetry pipeline unchecked.

5. **Main JS chunk is 6.7 MB uncompressed / 2.4 MB gzip.** This is very large for a single-page PWA. Users on slow connections will experience long load times even after Service Worker caches. Consider code-splitting by route/agent type.

6. **No ESLint or Prettier configuration.** No consistent code style enforcement. The sole lint directive is a `eslint-disable` comment that references a `@typescript-eslint` rule, but no eslint config exists in `package.json` or root.

### Moderate Issues

7. **`quickjs-emscripten` is excluded from Vite's `optimizeDeps`** but the sandbox manager creates a new `QuickJSSandbox` instance on every code execution via `sandboxManager.execute()`. QuickJS initialization is non-trivial (WASM compilation). Should be pre-initialized or cached.

8. **`tsconfig.json` excludes `src/__tests__` from compilation.** The vitest config covers them, but `tsc --noEmit` does not type-check test files. Any type errors in tests go unnoticed until vitest runs.

9. **Stale README note** ("The project folder is currently `test-ai-chat-web-llm` — may be renamed to `swarm` later") — the rename is clearly done now. This should be removed.

10. **`public/sandbox.html`** exists but the iframe sandbox uses `srcdoc` instead (inline in `iframe-sandbox.ts`). The file appears unused.

11. **Environment validation missing.** If PostHog keys are configured but invalid, the app still loads and PostHog silently fails. No user-facing feedback.

12. **`IndexedDB.databases()` method used in `storage-cleanup.ts`** — this is non-standard (Chrome only), not available in Firefox or Safari. The method is in a try-catch but affects cross-browser cleanup.

13. **Hardcoded `4 * 1024 * 1024 * 1024` (4 GB) estimate** for all model sizes in `useLLM.ts`. The recommended models range from ~2 GB to ~5 GB. This should use the actual per-model size from `RECOMMENDED_MODELS`.

### Minor Issues

14. **No browser target list in `.browserslist` or Vite config.** With WebGPU only available in Chrome/Edge 113+, Firefox/Safari users get a warning banner and no fallback.

15. **`posthogOptions` has `defaults: '2026-01-30'`.** This typo — the correct PostHog option is `superProperties` or `default`? Actually `defaults` is not a standard PostHog option. This may silently no-op.

16. **Dexie schema migration v2** adds `creatorAgent` to artifacts but the upgrade function defaults to `'general'` for existing rows. This is sensible, but no further migrations handle the `sharedWith` or `handoffId` fields declared in the `DBArtifact` type.

---

## 9. Top Improvements (Priority Order)

| # | Improvement | Severity | Effort |
|---|-------------|----------|--------|
| 1 | **Add a LICENSE file** (MIT or Apache 2.0) | Blocking | Minutes |
| 2 | **Remove or de-opt PostHog telemetry** to match the offline/privacy promise | High | Hours |
| 3 | **Add PWA icons** to manifest (`public/icon-192.png`, `public/icon-512.png`) | High | Minutes |
| 4 | **Fix protobufjs and picomatch vulnerabilities** via overrides or dep upgrades | High | Minutes-Hours |
| 5 | **Code-split the main JS chunk** — split by agent type or route, use dynamic imports for Mermaid/Excalidraw | Medium | Days |
| 6 | **Add Prettier and ESLint configs** for consistent code style | Medium | Hours |
| 7 | **Pre-initialize QuickJS WASM** on app load (lazy, but before first code exec) | Medium | Hours |
| 8 | **Add `tsc` to build pipeline** (`package.json` already has `tsc -b && vite build` — verify it runs) | Medium | Minutes |
| 9 | **Remove stale README note** about `test-ai-chat-web-llm` folder name | Low | Minutes |
| 10 | **Separate unused PWA build artifacts** — `public/sandbox.html` is unused | Low | Minutes |
| 11 | **Use per-model sizes** for storage checks instead of hardcoded 4 GB | Low | Minutes |
| 12 | **Add browser targets** and document WebGPU-only requirement clearly | Low | Minutes |

---

## 10. Baseline Command Results

| Command | Result |
|---------|--------|
| `pnpm install` | ✅ Succeeded (4.6 s, 614 MB) |
| `pnpm build` | ✅ Succeeded (6.32 s, 18 MB dist, 141 assets) |
| `pnpm test:run` | ✅ 8 files, 19 passed, 1 skipped (1.12 s) |
| `npx tsc --noEmit` | ✅ Passed (exit 0) |
| `pnpm audit` | ⚠️ 91 vulns (1 critical, 34 high, 48 moderate, 8 low) |
| `rsync source to dest` | ✅ 137 files, 1.0 MB copied |

### Diagnostics on Baseline Failures

No baseline failures occurred. All commands succeeded. The test suite is healthy (19/20 passing, 1 expected skip). The build produces a working PWA with a service worker. The only concerns are:

- **Vulnerability count is high** (91), particularly the critical protobufjs path. This is a transitive dependency of PostHog's OpenTelemetry integration and does not affect core app functionality, but should still be fixed.
- **Chunk size warnings** — the build completed without errors but warns about large chunks exceeding 500 kB.

---

*End of audit. Source copied to `/Users/averychan/Documents/amp/swarm` without `.git`, `node_modules`, `dist`, caches, credentials, or machine configuration.*
