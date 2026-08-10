# System Architecture: Agentic Web App with Browser-Based LLM

## 1. High-Level Component Diagram

```
+------------------------------------------------------------------+
|                        Browser (Client-Side Only)                 |
|                                                                   |
|  +--------------------+    +----------------------------------+   |
|  |    UI Layer         |    |    Agent Orchestration Layer     |   |
|  |  (React + Tailwind) |    |                                  |   |
|  |                     |    |  +----------+  +----------+      |   |
|  |  - Chat Panel       |<-->|  | AgentMgr |  | Router   |      |   |
|  |  - Agent Selector   |    |  +----------+  +----------+      |   |
|  |  - Tool Output View |    |       |             |             |   |
|  |  - Canvas / Preview |    |  +----------+  +----------+      |   |
|  +--------------------+    |  | ToolExec  |  | SkillMgr |      |   |
|                             |  +----------+  +----------+      |   |
|                             +----------------------------------+   |
|                                          |                         |
|  +--------------------+    +----------------------------------+   |
|  |  LLM Engine        |    |    Persistence Layer              |   |
|  |  (@mlc-ai/web-llm) |    |                                   |   |
|  |                     |    |  - IndexedDB (Dexie.js)          |   |
|  |  - OpenAI-compat API|    |  - Conversations, Agent State    |   |
|  |  - Runs in WebWorker|    |  - Model Cache (Cache API)      |   |
|  +--------------------+    +----------------------------------+   |
|                                                                   |
|  +--------------------+    +----------------------------------+   |
|  |  Sandbox Layer      |    |  Design Tool Layer               |   |
|  |                     |    |                                   |   |
|  |  - QuickJS WASM     |    |  - Mermaid.js renderer           |   |
|  |    (JS execution)   |    |  - Excalidraw component          |   |
|  |  - iframe sandbox   |    |  - SVG/PNG export                |   |
|  |    (HTML preview)   |    |                                   |   |
|  |  - Console capture  |    |  +---------------------------+    |   |
|  +--------------------+    |  | Monaco Editor (code view) |    |   |
|                             +----------------------------------+   |
+------------------------------------------------------------------+
```

## 2. Tech Stack

| Layer              | Technology                    | Rationale                                    |
|--------------------|-------------------------------|----------------------------------------------|
| Framework          | React 18+ (with hooks)        | Rich ecosystem, component model, wide adoption |
| Build Tool         | Vite                          | Fast HMR, native ESM, WASM support           |
| Language           | TypeScript (strict mode)      | Type safety for complex agent interfaces     |
| Styling            | Tailwind CSS + shadcn/ui      | Rapid UI, accessible components              |
| State Management   | Zustand                       | Lightweight, no boilerplate, middleware support |
| Persistence        | IndexedDB via Dexie.js        | Structured storage, large capacity, indexing  |
| LLM Runtime        | @mlc-ai/web-llm               | Apache 2.0, WebGPU, OpenAI-compatible API, Web Worker |
| LLM Fallback       | @huggingface/transformers     | WASM fallback for non-WebGPU browsers (future)|
| Code Sandbox (JS)  | quickjs-emscripten (QuickJS WASM)   | True isolation, ~500KB, no DOM/network access |
| Code Sandbox (HTML)| iframe (sandbox attr) + postMessage | HTML/CSS preview rendering in isolation |
| Code Editor        | Monaco Editor                       | VS Code-quality editing, syntax highlight |
| Diagrams           | Mermaid.js + @excalidraw/excalidraw | Rendering flowcharts and freeform diagrams |
| Markdown           | react-markdown + remark-gfm  | Chat message rendering                       |
| Routing            | React Router (optional)       | Multi-page layout if needed                  |
| Package Manager    | pnpm                          | Fast, disk-efficient                         |

## 3. Agent Orchestration Layer

### 3.1 Agent Definition

Each agent is a configuration object, not a class hierarchy. Agents are data-driven:

```typescript
interface AgentDefinition {
  id: AgentType;
  name: string;
  description: string;
  systemPrompt: string;
  skills: SkillId[];
  tools: ToolId[];
  canHandoffTo: AgentType[];
  maxIterations: number; // safety limit for observe-think-act loop
  temperature: number;
}

type AgentType = 'coder' | 'pm' | 'designer' | 'general';
```

### 3.2 Observe-Think-Act Loop

The core agent loop runs per turn:

```
User Message
    |
    v
[Observe] -> Gather context: conversation history, active tools, current state
    |
    v
[Think]   -> LLM inference with system prompt + skills + tool descriptions
    |
    v
[Act]     -> Parse LLM output:
             - If tool_call -> execute tool -> append result -> loop back to Think
             - If handoff   -> switch agent -> loop back to Observe
             - If final_answer -> return to user
             - If max_iterations reached -> return partial + warning
```

```typescript
interface AgentTurn {
  agentId: AgentType;
  messages: Message[];
  toolCalls: ToolCall[];
  handoff?: HandoffRequest;
  finalResponse?: string;
  iterations: number;
}
```

### 3.3 Agent Communication & Handoffs

Agents communicate through a shared conversation context. Handoffs are explicit:

```typescript
interface HandoffRequest {
  fromAgent: AgentType;
  toAgent: AgentType;
  reason: string;
  context: string; // summary for the receiving agent
}
```

The orchestrator intercepts handoff requests from the LLM output (via a structured tool call `handoff_to_agent`) and switches the active agent. The conversation history is shared, but each agent sees its own system prompt.

### 3.4 Router

An optional lightweight router agent (or heuristic) determines which agent should handle an initial user message:

```typescript
interface RouterDecision {
  selectedAgent: AgentType;
  confidence: number;
  reasoning: string;
}
```

For v1, this can be a keyword/intent classifier. For v2, the LLM itself can route.

## 4. Tool System

### 4.1 Tool Registration

Tools are registered in a central registry. Each tool declares its schema (for LLM function calling) and its execution function:

```typescript
interface ToolDefinition {
  id: ToolId;
  name: string;
  description: string;
  parameters: JSONSchema; // JSON Schema for input validation
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
  availableTo: AgentType[]; // which agents can use this tool
  requiresConfirmation?: boolean; // user approval before execution
}

interface ToolResult {
  success: boolean;
  output: string | object;
  artifacts?: Artifact[]; // files, images, diagrams produced
  error?: string;
}

type ToolId = string;
```

### 4.2 Built-in Tools

| Tool ID              | Agent(s)   | Description                              |
|----------------------|------------|------------------------------------------|
| `run_javascript`     | Coder      | Execute JS via QuickJS WASM sandbox      |
| `preview_html`       | Coder      | Render HTML/CSS/JS in sandboxed iframe   |
| `render_mermaid`     | Designer, PM | Render Mermaid diagram to SVG          |
| `render_excalidraw`  | Designer   | Create/update Excalidraw drawing         |
| `search_code`        | Coder      | Search through code artifacts            |
| `create_file`        | Coder      | Create a code artifact                   |
| `edit_file`          | Coder      | Edit an existing code artifact           |
| `handoff_to_agent`   | All        | Transfer conversation to another agent   |
| `create_task`        | PM         | Create a task/ticket                     |
| `web_search`         | General    | Search the web (if online)               |

### 4.3 Mock vs Real Interface

Tools implement a common interface. For testing/demo, a mock executor can be swapped in:

```typescript
interface ToolExecutor {
  execute(toolId: ToolId, params: Record<string, unknown>): Promise<ToolResult>;
}

class RealToolExecutor implements ToolExecutor { /* actual implementation */ }
class MockToolExecutor implements ToolExecutor { /* returns canned responses */ }
```

The executor is injected via React context or Zustand store, making it trivial to swap.

## 5. Skill System

Skills are specialized prompt fragments and behaviors that augment an agent:

```typescript
interface SkillDefinition {
  id: SkillId;
  name: string;
  description: string;
  promptFragment: string; // injected into system prompt
  examples?: FewShotExample[]; // few-shot examples appended to prompt
  requiredTools?: ToolId[]; // tools this skill depends on
}

interface FewShotExample {
  userMessage: string;
  assistantResponse: string;
  toolCalls?: ToolCall[];
}

type SkillId = string;
```

### Skill Examples by Agent

| Agent    | Skills                                                       |
|----------|--------------------------------------------------------------|
| Coder    | `code_generation`, `code_review`, `debugging`, `refactoring` |
| PM       | `task_breakdown`, `requirements_analysis`, `roadmap_planning`|
| Designer | `ui_mockup`, `diagram_creation`, `design_review`            |
| General  | `summarization`, `brainstorming`, `research`                 |

Skills are composed at runtime: the agent's system prompt is built from its base prompt + all skill prompt fragments.

## 6. State Management

### 6.1 In-Memory State (Zustand)

```typescript
interface AppState {
  // Conversation
  conversations: Conversation[];
  activeConversationId: string | null;

  // Agent
  activeAgent: AgentType;
  agentState: Record<AgentType, AgentRuntimeState>;

  // LLM
  llmStatus: 'loading' | 'ready' | 'generating' | 'error';
  llmProgress: number; // model download progress

  // UI
  sidebarOpen: boolean;
  activePanel: 'chat' | 'canvas' | 'preview';
}

interface AgentRuntimeState {
  isThinking: boolean;
  currentIteration: number;
  pendingToolCalls: ToolCall[];
}
```

### 6.2 Persistent State (IndexedDB via Dexie.js)

```typescript
// Dexie schema
const db = new Dexie('AgenticWebApp');
db.version(1).stores({
  conversations: '++id, title, createdAt, updatedAt',
  messages: '++id, conversationId, role, agentType, timestamp',
  artifacts: '++id, conversationId, type, name, createdAt',
  settings: 'key',
});
```

**What goes where:**
- **Zustand (memory):** Active session state, UI state, LLM status, agent runtime state
- **IndexedDB (disk):** Conversation history, messages, code artifacts, user settings, cached model weights (via Cache API)

### 6.3 Sync Strategy

On conversation load: read from IndexedDB into Zustand.
On each message: write-through to IndexedDB (append message, update conversation timestamp).
No server sync needed -- fully offline.

## 7. Sandboxed Code Execution

Two-layer sandbox architecture: QuickJS WASM for pure JavaScript execution, iframe sandbox for HTML/CSS preview.

### 7.1 Layer 1: QuickJS WASM (JavaScript Execution)

```
Main Thread
+-----------+                        +---------------------+
| Agent     |  vm.evalCode(code)     | quickjs-emscripten  |
| requests  | ---------------------> | (WASM sandbox)      |
| code exec |                        |                     |
|           |  result / error        | - No DOM access     |
|           | <--------------------- | - No network access |
|           |                        | - No fs access      |
|           |  intercepted console   | - ~500KB WASM       |
|           | <--------------------- | - Sync execution    |
+-----------+                        +---------------------+
```

**quickjs-emscripten** provides true sandboxed isolation:
- Runs QuickJS (a lightweight JS engine) compiled to WASM
- Code executes in a completely separate JS context with **zero access** to browser APIs, DOM, network, or filesystem
- `console.log/warn/error` intercepted via custom host functions registered on the VM
- Execution timeout via `vm.setInterruptHandler()` with iteration counting
- Memory limit configurable on the WASM instance
- Synchronous execution -- no async/Promise support in the sandbox (safe by design)
- ~500KB WASM binary, loads lazily on first code execution

```typescript
interface QuickJSSandbox {
  evaluate(code: string): Promise<ExecutionResult>;
  dispose(): void;
}

interface ExecutionResult {
  success: boolean;
  value?: string;          // serialized return value
  error?: string;          // error message if failed
  logs: ConsoleEntry[];    // intercepted console output
  executionTimeMs: number;
}

interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info';
  args: string[];
  timestamp: number;
}
```

### 7.2 Layer 2: iframe Sandbox (HTML/CSS Preview)

For rendering HTML/CSS/JS output (e.g., Coder agent generates a web page), use a sandboxed iframe:

```
Main Thread                          Preview iframe
+-----------+                        +------------------+
| Agent     |  postMessage({html})   | sandbox="allow-  |
| requests  | ---------------------> |  scripts"        |
| preview   |                        |                  |
|           |                        | - Renders HTML   |
|           |                        | - Runs inline JS |
|           |                        | - No parent DOM  |
+-----------+                        +------------------+
```

- `sandbox="allow-scripts"` with srcdoc-based content
- CSP meta tag: `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">`
- Used for visual preview only, not for capturing execution results
- Iframe is destroyed and recreated for each new preview

### 7.3 Code Editor

Monaco Editor is used for code display and editing in the Coder agent:
- Syntax highlighting for JS, HTML, CSS, JSON
- Read-only mode for LLM-generated code, editable mode for user modifications
- Integrated into the right panel alongside execution output

### 7.4 Future: Pyodide for Python

The QuickJS sandbox pattern can be complemented with Pyodide (Python in WASM) for Python code execution in a future version.

## 8. Design Tool Integration

### 8.1 Mermaid.js

- Import `mermaid` library, render diagrams from LLM-generated Mermaid syntax
- Render to SVG inline in the chat or in a dedicated preview panel
- Wrap in a React component: `<MermaidDiagram definition={mermaidString} />`

### 8.2 Excalidraw

- Use `@excalidraw/excalidraw` React component
- LLM generates Excalidraw element JSON via the `render_excalidraw` tool
- Programmatic update via `excalidrawAPI.updateScene({ elements })` with JSON element array
- User can interactively edit after generation
- Scene state saved to IndexedDB as an artifact

### 8.3 Rendering Pipeline

```
LLM Output -> Tool Call (render_mermaid / render_excalidraw)
           -> Tool Executor parses + validates
           -> React component renders in preview panel
           -> Artifact saved to IndexedDB
```

## 9. Folder Structure

```
src/
  app/
    App.tsx                    # Root component, providers
    routes.tsx                 # Route definitions
  components/
    chat/
      ChatPanel.tsx            # Main chat view
      MessageBubble.tsx        # Single message display
      InputBar.tsx             # User input with agent selector
    canvas/
      MermaidDiagram.tsx       # Mermaid rendering component
      ExcalidrawCanvas.tsx     # Excalidraw wrapper
      CodePreview.tsx          # Sandboxed HTML preview (iframe)
      CodeEditor.tsx           # Monaco editor wrapper
    layout/
      Sidebar.tsx              # Conversation list
      Header.tsx               # App header, agent indicator
      PanelSplitter.tsx        # Resizable panels
    ui/                        # shadcn/ui primitives
  agents/
    definitions/
      coder.ts                 # Coder agent definition
      pm.ts                    # PM agent definition
      designer.ts              # Designer agent definition
      general.ts               # General agent definition
    orchestrator.ts            # Observe-think-act loop
    router.ts                  # Agent routing logic
    handoff.ts                 # Handoff handling
  tools/
    registry.ts                # Tool registration and lookup
    executor.ts                # Real tool executor
    mock-executor.ts           # Mock tool executor for testing
    definitions/
      run-javascript.ts        # QuickJS sandbox tool
      preview-html.ts          # iframe HTML preview tool
      render-mermaid.ts        # Mermaid tool
      render-excalidraw.ts     # Excalidraw tool
      create-file.ts           # File creation tool
      handoff.ts               # Handoff tool
  skills/
    registry.ts                # Skill registration
    definitions/
      code-generation.ts
      task-breakdown.ts
      diagram-creation.ts
      ...
  llm/
    engine.ts                  # LLM engine abstraction
    web-llm-provider.ts        # WebLLM implementation
    transformers-provider.ts   # Transformers.js fallback
    prompt-builder.ts          # System prompt assembly
  sandbox/
    quickjs-sandbox.ts         # QuickJS WASM sandbox manager
    iframe-preview.ts          # iframe HTML preview manager
    sandbox.html               # srcdoc template for iframe preview
    console-interceptor.ts     # Console capture for QuickJS VM
  store/
    app-store.ts               # Zustand store
    slices/
      conversation-slice.ts
      agent-slice.ts
      llm-slice.ts
      ui-slice.ts
  db/
    schema.ts                  # Dexie schema definition
    repositories/
      conversations.ts         # Conversation CRUD
      messages.ts              # Message CRUD
      artifacts.ts             # Artifact CRUD
  types/
    agent.ts                   # Agent-related types
    tool.ts                    # Tool-related types
    skill.ts                   # Skill-related types
    message.ts                 # Message types
    conversation.ts            # Conversation types
  utils/
    json-schema.ts             # JSON schema validation
    id.ts                      # ID generation (nanoid)
  public/
    sandbox.html               # Sandbox iframe template
  index.html
  main.tsx
  vite.config.ts
  tsconfig.json
  tailwind.config.ts
  package.json
```

## 10. Key TypeScript Interfaces

### Message

```typescript
type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  agentType?: AgentType;
  toolCall?: ToolCall;
  toolResult?: ToolResult;
  artifacts?: Artifact[];
  timestamp: number;
  metadata?: Record<string, unknown>;
}

interface ToolCall {
  id: string;
  toolId: ToolId;
  parameters: Record<string, unknown>;
}
```

### Conversation

```typescript
interface Conversation {
  id: string;
  title: string;
  messages: Message[]; // in-memory only; persisted separately
  activeAgent: AgentType;
  createdAt: number;
  updatedAt: number;
}
```

### Artifact

```typescript
type ArtifactType = 'code' | 'diagram-mermaid' | 'diagram-excalidraw' | 'image' | 'document';

interface Artifact {
  id: string;
  conversationId: string;
  type: ArtifactType;
  name: string;
  content: string; // source code, mermaid definition, excalidraw JSON
  language?: string; // for code artifacts
  createdAt: number;
  updatedAt: number;
}
```

### LLM Provider

```typescript
interface LLMProvider {
  load(modelId: string, onProgress?: (progress: number) => void): Promise<void>;
  generate(request: LLMRequest): AsyncGenerator<string>; // streaming
  isLoaded(): boolean;
  unload(): Promise<void>;
}

interface LLMRequest {
  messages: Array<{ role: string; content: string }>;
  tools?: ToolDefinition[]; // for function calling
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}
```

---

## Design Decisions & Trade-offs

1. **Data-driven agents over class hierarchy**: Agents are config objects, not subclasses. This makes them serializable, easy to add, and avoids complex inheritance.

2. **QuickJS WASM for JS execution, iframe for HTML preview**: QuickJS WASM (~500KB) provides true sandboxed isolation -- the executed code has zero access to browser APIs, DOM, or network. This is stronger than iframe sandbox (which still runs in a browser JS context). The iframe sandbox is reserved for HTML/CSS visual preview where DOM rendering is needed.

3. **Zustand over Redux/Context**: Minimal boilerplate, built-in middleware (persist, devtools), excellent TypeScript support, no provider wrapping needed.

4. **Dexie.js over raw IndexedDB**: Dexie provides a Promise-based API, schema versioning, and compound indexes with minimal overhead (~15KB).

5. **Write-through persistence**: Every message is immediately persisted to IndexedDB. This prevents data loss on tab close without needing complex sync logic.

6. **Streaming responses**: The LLM provider uses AsyncGenerator for token streaming, enabling real-time response display.

7. **Tool schema as JSON Schema**: Using JSON Schema for tool parameters enables automatic validation and makes tool descriptions self-documenting for the LLM.

---

## Appendix A: Resolved Research Questions

### A.1 LLM Runtime (Task #1 findings)

**Primary: @mlc-ai/web-llm** -- Apache 2.0 license, fully free, no commercial restrictions. Supports WebGPU for GPU-accelerated inference. Provides built-in function calling support, streaming, and model caching via Cache API. Recommended models for agentic use:
- **Llama 3.1 8B Instruct (q4f16_1)**: Good balance of quality and size (~4GB). Supports tool/function calling.
- **Phi-3.5 Mini Instruct (q4f16_1)**: Smaller (~2GB), faster, decent quality for simpler tasks.
- **Qwen2.5 7B Instruct (q4f16_1)**: Strong multilingual support, good at structured output.

**Fallback: @huggingface/transformers (v3+)** -- Apache 2.0, WASM-based, works without WebGPU. Slower but broader browser compatibility. Use for browsers without WebGPU support.

**Model caching**: web-llm uses the browser Cache API (not IndexedDB) for model weights. Cache API has no hard size limit but browsers may evict under storage pressure. Use `navigator.storage.persist()` to request persistent storage.

### A.2 Code Sandbox (Task #2 findings)

**Primary: quickjs-emscripten (QuickJS compiled to WASM)** -- true sandboxed isolation for JavaScript execution.
- Code runs in a completely separate JS engine with zero access to browser APIs
- ~500KB WASM binary, loaded lazily on first use
- `vm.evalCode()` for execution, custom host functions for console interception
- Timeout via `vm.setInterruptHandler()`, memory limits configurable
- No async/Promise support in sandbox (safe by design)

**Secondary: iframe sandbox** -- for HTML/CSS visual preview only.
- `sandbox="allow-scripts"` with srcdoc-based content
- CSP meta tag blocks network from sandbox
- Used when Coder agent generates renderable HTML output

**Why not alternatives:**
- **Web Workers**: Share same origin, can use `importScripts()` and `fetch()` -- weaker isolation
- **ShadowRealm**: Still a TC39 Stage 3 proposal, not shipped in any browser
- **iframe-only**: Runs in a full browser JS context -- while sandboxed, still has more attack surface than WASM-isolated QuickJS

### A.3 Agentic Framework (Task #3 findings)

**Recommendation: Custom lightweight framework** -- existing browser-side agentic frameworks (LangChain.js, LlamaIndex.TS) are designed for server-side Node.js and bring heavy dependencies, complex abstractions, and API-key-oriented patterns that don't fit a fully client-side architecture. A custom ~500-line orchestrator is simpler and more maintainable.

**Design tool libraries:**
- **Mermaid.js** (MIT): Mature, well-documented, renders to SVG. ~200KB gzipped. Text-based diagrams.
- **@excalidraw/excalidraw** (MIT): Full React component, programmatic API via `updateScene()` with JSON elements. ~500KB gzipped. Freeform diagrams. Both included in MVP.

**State management:**
- **Dexie.js** (Apache 2.0): Best IndexedDB wrapper. Promise-based, schema versioning, live queries, ~15KB gzipped.
- localStorage only for simple key-value preferences (theme, last selected agent).
- IndexedDB for all structured data (conversations, messages, artifacts, tasks).

### A.4 Tool Call Format

Since web-llm supports OpenAI-compatible function calling, tool definitions will use the OpenAI function calling schema format. The orchestrator converts `ToolDefinition.parameters` (JSON Schema) into the format expected by the LLM's chat completion API. Tool calls are parsed from the LLM response's `tool_calls` field.

```typescript
// Conversion for LLM consumption
function toolToLLMFunction(tool: ToolDefinition): LLMFunctionDef {
  return {
    type: 'function',
    function: {
      name: tool.id,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
```
