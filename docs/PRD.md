# Product Requirements Document: Agentic Web App with Browser-Based LLM

**Version**: 1.0
**Date**: 2026-03-21
**Author**: PM Agent

---

## 1. Problem Statement & Product Vision

### Problem
Developers and power users want to experiment with agentic AI workflows -- code generation, task management, diagram creation, and general chat -- without relying on cloud APIs, paid subscriptions, or network connectivity. Existing solutions either require server-side inference, API keys with usage costs, or lack the multi-agent orchestration that makes AI assistants truly useful.

### Vision
Build a **fully client-side, offline-capable web application** that runs a large language model entirely in the browser. The app provides multiple specialized AI agents (Coder, PM, Designer, General) that can hand off tasks to each other, use toggleable tools, and persist all state locally. Despite being a test/prototype, it must function as a real, working product -- not a toy demo.

---

## 2. User Personas & Use Cases

### Persona 1: Solo Developer ("Dev Dana")
- Wants to generate and execute JavaScript code snippets without leaving the browser
- Needs offline capability for working on planes, in cafes with poor wifi, etc.
- Values privacy: no code sent to external servers

### Persona 2: Project Manager ("PM Pat")
- Wants to plan tasks, break down work, and manage lightweight project tracking
- Uses the PM agent for brainstorming, writing specs, and organizing ideas
- Needs persistence across browser sessions

### Persona 3: Technical Designer ("Designer Drew")
- Creates architecture diagrams, flowcharts, and system designs
- Wants Mermaid and Excalidraw diagram generation from natural language
- Shares diagrams by exporting from the browser

### Persona 4: General User ("General Gwen")
- Wants a ChatGPT-like experience that works offline and is free
- Toggles tools on/off to customize the assistant's capabilities
- Explores what agents can do by switching between them

### Key Use Cases
1. Generate, preview, and run JavaScript code in a sandboxed environment
2. Create and manage task lists and project plans via conversation
3. Generate Mermaid diagrams and Excalidraw sketches from descriptions
4. Chat freely with a general-purpose assistant, toggling available tools
5. Hand off tasks between agents (e.g., PM defines requirements, Coder implements)
6. Resume previous conversations and projects after closing the browser

---

## 3. Functional Requirements

### 3.1 LLM Engine
- **FR-LLM-1**: Run an LLM entirely in-browser using **@mlc-ai/web-llm** (Apache 2.0) with WebGPU acceleration
- **FR-LLM-2**: Support model loading with progress indication (download + initialization)
- **FR-LLM-3**: Stream tokens to the UI as they are generated via web-llm's OpenAI-compatible chat completion API
- **FR-LLM-4**: Allow model selection from available 1B-8B parameter models with 4-bit quantization. Recommended: **Phi 3.5 Mini** (~71 tok/s, fastest) and **Llama 3.1 8B q4** (~41 tok/s, best quality). Also support SmolLM2, Qwen2.5 for smaller footprint
- **FR-LLM-5**: Cache model weights in browser storage (Cache API / IndexedDB) to avoid re-downloading
- **FR-LLM-6**: Provide **wllama** as a CPU/WASM fallback for browsers without WebGPU support

### 3.2 Agentic Framework (Custom, ~100-200 LOC)
- **FR-AGT-1**: Custom lightweight tool-calling loop: prompt LLM -> parse tool calls -> execute tools -> feed results back -> repeat. No external framework (LangChain.js requires Node APIs; Vercel AI SDK is server-oriented)
- **FR-AGT-2**: Support multiple agent types, each with distinct system prompts and tool sets
- **FR-AGT-3**: Implement agent handoff protocol -- one agent can delegate to another with context
- **FR-AGT-4**: Maintain conversation context per agent and across handoffs
- **FR-AGT-5**: Provide a router/orchestrator that determines which agent should handle a request (or let the user choose manually)
- **FR-AGT-6**: Each agent's tools must be individually toggleable by the user
- **FR-AGT-7**: Agent tool-calling loop: LLM generates structured tool calls, framework executes them, feeds results back to LLM until final response

### 3.3 Coder Agent
- **FR-COD-1**: Generate JavaScript/HTML/CSS code from natural language prompts
- **FR-COD-2**: Execute pure JavaScript in a **QuickJS WASM sandbox** (quickjs-emscripten, ~564KB). Uses `vm.evalCode()` with discriminated success/error results. Supports ES2023.
- **FR-COD-3**: Capture console output (log/warn/error) via exposed host functions on the QuickJS VM
- **FR-COD-4**: Enforce execution time limits via `vm.setInterruptHandler()` to prevent infinite loops
- **FR-COD-5**: Preview HTML/CSS/JS in a **sandboxed iframe** (`sandbox="allow-scripts"`, no `allow-same-origin`) with blob URL origin for output rendering
- **FR-COD-6**: Display code with syntax highlighting
- **FR-COD-7**: Show execution results (console output, rendered HTML preview, errors)
- **FR-COD-8**: Tools: code execution (QuickJS), HTML preview (iframe), code formatting, snippet saving

### 3.4 PM Agent
- **FR-PM-1**: Create, update, and manage task lists
- **FR-PM-2**: Break down high-level goals into subtasks
- **FR-PM-3**: Generate text documents (specs, plans, notes)
- **FR-PM-4**: Tools: task CRUD, document generation, priority sorting

### 3.5 Designer Agent
- **FR-DES-1**: Generate Mermaid diagram syntax from natural language
- **FR-DES-2**: Render Mermaid diagrams inline in the chat using **Mermaid.js** (MIT)
- **FR-DES-3**: Generate Excalidraw element JSON arrays (`{ type, id, x, y, width, height, strokeColor, ... }`) from natural language using **@excalidraw/excalidraw** React component (MIT)
- **FR-DES-4**: Render Excalidraw diagrams in contextual right panel via `excalidrawAPI.updateScene({ elements })` for interactive editing
- **FR-DES-5**: Allow export/download of generated diagrams via `exportToSvg`, `exportToClipboard`, `loadFromBlob`
- **FR-DES-6**: Tools: Mermaid rendering, Excalidraw generation, diagram export

### 3.6 General Agent
- **FR-GEN-1**: Provide open-ended chat without domain-specific constraints
- **FR-GEN-2**: All tools from other agents available but off by default
- **FR-GEN-3**: User can toggle any tool on/off from a tool palette
- **FR-GEN-4**: Tools: web search (mocked), calculator, summarizer, etc.

### 3.7 Tool System
- **FR-TOOL-1**: Tools are defined with a name, description, input schema, and execute function
- **FR-TOOL-2**: Tools are initially mocked with realistic stub responses
- **FR-TOOL-3**: Tool interface is designed so mocks can be swapped for real implementations without changing agent code
- **FR-TOOL-4**: Each agent has a default set of enabled tools
- **FR-TOOL-5**: Users can override tool availability per agent via UI toggles
- **FR-TOOL-6**: Tool calls and results are visible in the chat UI

### 3.8 Persistence & State
- **FR-PER-1**: Conversation history, agent state, tool outputs, and drawing data persist via **Dexie.js** over IndexedDB (up to 80% of disk in Chrome)
- **FR-PER-2**: Call `navigator.storage.persist()` at startup to prevent browser from evicting data
- **FR-PER-3**: User preferences (tool toggles, selected agent, theme, UI layout) persist in localStorage (5MB cap, UI prefs only)
- **FR-PER-4**: Application state managed with **Zustand** for reactive UI updates
- **FR-PER-5**: Support export/import of all persisted data (JSON format)
- **FR-PER-6**: No server-side storage or databases

### 3.9 Chat UI
- **FR-UI-1**: **Three-column layout**: left sidebar (240px), center chat workspace (flexible), right panel (400px, collapsible on demand)
- **FR-UI-2**: Chat interface with message bubbles, agent avatars, and typing indicators
- **FR-UI-3**: Vertical agent list in left sidebar with avatar icons and status dots (idle=gray, thinking=amber, responding=green). Keyboard shortcuts Cmd+1..4 for quick agent switching
- **FR-UI-4**: Each agent maintains its own conversation thread; switching agents switches chat context
- **FR-UI-5**: Tool toggle panel per agent (accessible from chat header or right panel settings)
- **FR-UI-6**: Conversation history in left sidebar with search
- **FR-UI-7**: Right panel adapts to context: code editor (Monaco) + output console for Coder, Excalidraw canvas + Mermaid preview for Designer, task board for PM, settings for General
- **FR-UI-8**: Built with **React + Tailwind CSS** for rapid, consistent styling
- **FR-UI-9**: Responsive layout with three breakpoints:
  - 1280px+: Full three-column layout
  - 768-1279px: Sidebar collapses to icon rail, right panel becomes overlay drawer
  - <768px: Single column, sidebar as hamburger menu, right panel as full-screen modal
- **FR-UI-10**: Dark mode default with light mode toggle

### 3.10 Component Hierarchy
```
App > AppLayout
  |- Sidebar: AgentList, ConversationHistory, SidebarFooter
  |- MainWorkspace: ChatView (MessageList + ChatInput) + StatusBar
  |- RightPanel (collapsible): CodeEditorView (Monaco + OutputConsole),
  |                             DiagramView (Mermaid + Excalidraw),
  |                             SettingsPanel
Providers: AgentProvider, LLMProvider, ThemeProvider
```

---

## 4. Non-Functional Requirements

### 4.1 Offline & Client-Side
- **NFR-OFF-1**: App must work entirely offline after initial load (service worker for asset caching)
- **NFR-OFF-2**: No external API calls required for core functionality
- **NFR-OFF-3**: First model load requires network; subsequent launches use cached weights

### 4.2 Performance
- **NFR-PERF-1**: UI must remain responsive during model inference (web-llm runs in Web Worker)
- **NFR-PERF-2**: Token generation should begin within 5 seconds of prompt submission (hardware-dependent). Target: ~41-71 tok/s on WebGPU depending on model
- **NFR-PERF-3**: App shell should load in under 2 seconds on modern hardware
- **NFR-PERF-4**: Model loading progress must be communicated to the user (initial download: 200-600MB per model)
- **NFR-PERF-5**: ~4GB VRAM limit per Chrome tab constrains max model size; enforce model selection within this budget

### 4.3 Security
- **NFR-SEC-1**: Code execution must be sandboxed -- no access to main page DOM, localStorage, or IndexedDB
- **NFR-SEC-2**: Generated code cannot make network requests outside the sandbox
- **NFR-SEC-3**: No user data leaves the browser
- **NFR-SEC-4**: Content Security Policy headers should restrict inline scripts outside sandbox

### 4.4 Compatibility
- **NFR-COMP-1**: Primary target: Chrome/Edge with WebGPU (~82-90% browser coverage as of 2026)
- **NFR-COMP-2**: CPU fallback via **wllama** (llama.cpp WASM) for the ~10-18% of users without WebGPU -- slower but functional
- **NFR-COMP-3**: Detect WebGPU support at startup and auto-select appropriate backend with user notification

### 4.5 Licensing
- **NFR-LIC-1**: All dependencies must be free and open-source (MIT, Apache 2.0, or similarly permissive)
- **NFR-LIC-2**: LLM model weights must have permissive licenses allowing free use
- **NFR-LIC-3**: No usage-based costs or API keys required

---

## 5. MVP Scope vs Future Scope

### MVP (v1.0)
- web-llm with 1B-8B 4-bit quantized models (WebGPU) + wllama CPU fallback
- Four agent types with distinct system prompts and custom tool-calling loop
- Basic agentic handoff (user-initiated or simple keyword-based routing)
- Coder agent with QuickJS WASM sandbox + iframe HTML preview
- PM agent with task list management (Dexie.js persistence)
- Designer agent with Mermaid.js diagrams + Excalidraw React component
- General agent with toggleable tools from all agents
- Tool toggle UI per agent
- Dexie.js/IndexedDB persistence for conversations, tasks, and artifacts
- Zustand for reactive state management
- Mocked tools with realistic stubs (designed for real swap-in)
- Three-column React + Tailwind CSS UI with contextual right panel
- Offline support via service worker (Workbox/Vite PWA)

### Future Scope (v2.0+)
- Smarter agent routing (LLM-based intent classification)
- Multi-turn tool use (agent chains multiple tool calls autonomously)
- Collaborative multi-agent workflows (agents work in parallel)
- Voice input/output
- Plugin system for community-contributed tools
- Model fine-tuning or adapter support in-browser
- PWA with install prompt
- Import/export of entire workspace
- Real implementations replacing mocked tools
- Larger models as WebGPU/hardware improves

---

## 6. Success Criteria

| Criterion | Measurement |
|-----------|-------------|
| Offline functionality | App loads and runs inference with no network after initial setup |
| Code execution works | Coder agent generates JS that runs in sandbox and displays results |
| Agent handoff works | User or system can switch between agents with context preserved |
| Persistence works | Closing and reopening browser retains all conversations and data |
| Tool toggles work | User can enable/disable tools per agent and changes take effect immediately |
| Mermaid diagrams render | Designer agent produces valid Mermaid that renders inline |
| Excalidraw diagrams work | Designer agent generates Excalidraw JSON that renders in the interactive canvas |
| Task management works | PM agent can create, list, update, and complete tasks |
| Performance acceptable | UI stays responsive during inference; tokens stream visibly |
| Truly working product | Not a demo -- all features function end-to-end as described |

---

## 7. Open Questions

1. **Model context window limits**: Smaller browser models (1B-4B params) have limited context (2K-4K tokens). Need conversation summarization or sliding window strategy for multi-turn agent conversations and handoffs.
2. **Model caching storage limits**: Cached 4-bit quantized model weights range from ~500MB (1B) to ~4GB (8B). Browser storage quotas vary by browser; need graceful quota-exceeded handling and user guidance.
3. **Tool call format**: Function-calling in web-llm is still WIP. Need regex-based JSON parsing as primary strategy with structured function-calling as future upgrade when web-llm stabilizes support.
4. **Excalidraw bundle size**: Excalidraw adds significant bundle weight (~2MB+). Consider lazy-loading the Excalidraw component only when Designer agent is active.
5. **wllama model compatibility**: Verify that the same models work across both web-llm (WebGPU) and wllama (WASM) backends, or define separate model lists per backend.

---

## Appendix A: Technology Stack (Finalized)

| Component | Decision | License | Rationale |
|-----------|----------|---------|-----------|
| LLM Runtime (GPU) | **@mlc-ai/web-llm** | Apache 2.0 | Mature WebGPU support, built-in model caching, streaming, OpenAI-compatible chat API with function calling |
| LLM Runtime (CPU) | **wllama** | MIT | llama.cpp compiled to WASM; CPU fallback for browsers without WebGPU |
| Models | **1B-8B with 4-bit quantization**: Phi 3.5 Mini (~71 tok/s), Llama 3.1 8B q4 (~41 tok/s), SmolLM2, Qwen2.5 | Various permissive | User-selectable; small models for low-end hardware, larger for quality. Initial download 200-600MB. |
| Embeddings (future) | **Transformers.js v4** | Apache 2.0 | Complementary for embeddings/classification if needed later |
| JS Sandbox (pure JS) | **quickjs-emscripten** (QuickJS WASM) | MIT | Complete WASM isolation (~564KB), ES2023 support, `evalCode()` + interrupt handler for timeouts |
| JS Sandbox (HTML) | **iframe** with `sandbox="allow-scripts"` | N/A (browser API) | DOM rendering for HTML/CSS/JS preview; `postMessage` for communication |
| Agentic Framework | **Custom** (agent registry + tool-calling loop + router) | N/A | Lightweight, no heavy dependencies; ~100-200 LOC. LangChain.js requires `node:async_hooks`; Vercel AI SDK is server-oriented |
| Diagrams (structured) | **Mermaid.js** | MIT | Lightweight (~300KB), text-based syntax LLMs generate well, built-in sandboxed iframe rendering to prevent script injection |
| Diagrams (freeform) | **@excalidraw/excalidraw** | MIT | React component, interactive editing, JSON-based format LLMs can produce |
| UI Framework | **React** + **Vite** | MIT | Ecosystem maturity, Excalidraw compatibility, fast builds |
| Styling | **Tailwind CSS** | MIT | Utility-first, rapid development, consistent design system |
| State Management | **Zustand** | MIT | Lightweight, React-native, no boilerplate |
| Persistence | **Dexie.js** (IndexedDB) + **localStorage** | Apache 2.0 / N/A | Dexie for structured data (conversations, tasks, artifacts); localStorage for preferences |
| Code Editor | **Monaco Editor** (@monaco-editor/react) | MIT | Full-featured code editor in right panel for Coder agent |
| Code Highlighting | **Prism.js** or **highlight.js** | MIT | Lightweight syntax highlighting in chat messages |
| Markdown | **react-markdown** | MIT | Render agent responses with formatting |
| Offline/PWA | **Workbox** (via vite-plugin-pwa) | MIT | Service worker caching for offline support |
