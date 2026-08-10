# Model Compatibility Abstraction Layer

## Problem

The orchestrator (`src/agents/orchestrator.ts`) assumes all models behave identically: it sends tools via the `LLMChat` interface and expects structured `toolCalls` back. In reality:

- **Hermes models** have WIP native function calling but reject system prompts when tools are present.
- **Llama 3.1 Instruct**, **Phi 3.5 Mini**, and others do not support native tool calling.
- **Qwen 3** models are actually the best at tool use even without native support.
- Different models have different context window sizes.

The orchestrator should never know or care about model differences.

## Strategy: Text-Based Tool Calling as Primary Path

**Key insight:** Text-based (prompt-engineered) tool calling works across ALL models and is more reliable than native function calling in web-llm, which is WIP and only available on Hermes. By injecting tool descriptions + few-shot examples into the prompt and parsing JSON from model output, we get consistent tool calling from any model.

- **Default:** All models use `json-text` (prompt-engineered tool calling)
- **Optional optimization:** Hermes models can use `native` function calling, with automatic fallback to `json-text` on failure
- **Recommended models:** Qwen 3 8B/4B are top-tier for tool calling via text

---

## Design

### 1. Model Capability Registry

File: `src/llm/model-capabilities.ts`

```typescript
export interface ModelCapabilities {
  supportsNativeFunctionCalling: boolean;
  supportsSystemPromptWithTools: boolean;
  maxContextTokens: number;
  toolCallFormat: 'native' | 'json-text' | 'none';
}
```

All models default to `toolCallFormat: 'json-text'`. Hermes models have `supportsNativeFunctionCalling: true` but still use `json-text` by default.

**Fallback matcher:** If the exact ID is not found, match by regex pattern (e.g. `/qwen/i`, `/hermes/i`). Unknown models get a conservative default (`json-text`, 4096 tokens).

**Auto-downgrade:** Session-level failure tracking. After 3 native tool calling failures, `getModelCapabilities()` automatically downgrades that model to `json-text` for the rest of the session.

### 2. Adaptive Request Builder

File: `src/llm/request-builder.ts`

| Condition | Action |
|---|---|
| `toolCallFormat === 'json-text'` (primary) | Remove `tools` from request. Append tool descriptions + few-shot examples to system prompt. |
| `toolCallFormat === 'native'` | Pass `tools` array to the provider as-is. |
| `toolCallFormat === 'none'` | Remove `tools`. No tool instructions. |
| `!supportsSystemPromptWithTools` | Move system message to user message prefixed with `[System Instructions]`. |
| Messages exceed `maxContextTokens` | Truncate oldest non-system messages. Keep system prompt + most recent messages that fit. |

**Few-shot examples** are included in the text-based tool prompt to help models output the correct JSON format consistently.

**Token estimation:** chars / 4 heuristic (no tokenizer dependency).

### 3. Adaptive Response Parser

File: `src/llm/response-parser.ts`

| Format | Parsing |
|---|---|
| `json-text` (primary) | Scan response text line-by-line for JSON tool call patterns. Parse, extract, normalize into `LLMToolCall[]`. Strip matched lines from content. |
| `native` | No parsing needed. Tool calls come structured from the provider. |
| `none` | Return content as-is, no tool calls. |

**Robustness features:**
- Handles markdown code fence wrapping (` ```json ... ``` `)
- Multiple JSON formats: `{"tool_call": {...}}` and `{"name": "...", "arguments": {...}}`
- JSON repair for common LLM quirks: trailing commas, single quotes, unquoted keys
- Synthetic `id` values (`call_0`, `call_1`, ...) for text-based responses

### 4. CompatibilityLayer (Decorator)

File: `src/llm/compatibility-layer.ts`

```
Orchestrator -> LLMChatAdapter -> CompatibilityLayer -> WebLLMProvider
```

The compatibility layer wraps `LLMProvider` transparently:
1. Text-based path (primary): adapt request, stream through for UI, accumulate, parse tool calls at finish
2. Native path (Hermes optimization): pass through, fall back to text-based on error
3. No tools: pass through directly

### 5. Changes to Existing Files

| File | Change |
|---|---|
| `src/llm/web-llm-provider.ts` | Stripped `isHermesModel()`, `supportsToolCalling()`, system-prompt workaround. Now a thin pass-through. |
| `src/llm/engine.ts` | Updated `RECOMMENDED_MODELS`: added Qwen 3 8B/4B at top, updated descriptions for all models. |
| `src/llm/provider-singleton.ts` | Wraps `WebLLMProvider` with `CompatibilityLayer`. |
| `src/llm/llm-chat-adapter.ts` | No changes. |
| `src/agents/orchestrator.ts` | No changes. |

### 6. New Files

| File | Purpose |
|---|---|
| `src/llm/model-capabilities.ts` | `ModelCapabilities` type, registry, `getModelCapabilities()`, failure tracking |
| `src/llm/request-builder.ts` | `buildAdaptiveRequest()` with few-shot examples |
| `src/llm/response-parser.ts` | `parseToolCalls()` with JSON repair |
| `src/llm/compatibility-layer.ts` | `CompatibilityLayer` decorator class |

---

## Non-Goals

- **Tokenizer integration** -- chars/4 heuristic is sufficient for now.
- **Persistent capability learning** -- session-only failure tracking. No localStorage.
- **Supporting non-web-llm providers** -- the `LLMProvider` interface already abstracts this.
- **Automatic model selection** -- the user still picks the model. We just make any model work.
