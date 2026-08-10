# Agentic Framework Patterns for Small Browser-Based Models

Research findings for building a custom agentic framework using web-llm with 1-8B parameter models.

---

## 1. Tool Calling with Small Models (1-8B, 4-bit Quantized)

### Key Reality Check

Small models (1-8B) **struggle significantly** with tool calling out of the box. Meta explicitly recommends 70B+ for combined conversation + tool calling. In zero-shot settings, most SLMs fail to generate valid JSON — only Deepseek-Coder-1.3b achieved 7.34% JSON parsability zero-shot.

### What Works

- **Structured/template prompting outperforms chain-of-thought.** LLaMA-3.1-8B with template prompting scored 68.28 on BFCL vs 66.70 with CoT. Explicitly structured formats guide small models better than asking them to "think step by step."
- **Few-shot examples are critical.** Deepseek-Coder jumped from 7.34% to 89.38% JSON parsability with few-shot prompting. Even 3 well-chosen examples match 9 examples in performance.
- **Keep tool definitions minimal.** Small models have limited context — verbose function descriptions consume tokens and confuse the model. Use short, clear names and compact schemas.
- **Constrain output format.** Always specify the exact JSON schema in the prompt. Consider using grammar-constrained decoding if available.
- **One tool at a time.** Disable parallel tool calls for small models. Even OpenAI's nano model misfires with parallel calls.

### Recommended Models for WebLLM Tool Calling

| Model | Size | Notes |
|-------|------|-------|
| Hermes-2-Pro-Llama-3-8B | 8B | Best open-source function-calling model, trained specifically for tool use |
| Hermes-2-Pro-Mistral-7B | 7B | Good alternative, same training methodology |
| Qwen2-7B-Instruct | 7B | Strong instruction following, decent tool calling |
| Phi-3-mini | 3.8B | Struggles with JSON format even with few-shot |
| Llama-3.2-3B-Instruct | 3B | Basic tool calling possible with fine-tuning |

**Recommendation:** Target Hermes-2-Pro models as primary, with Qwen2 as fallback. Models below 7B will need significant prompt engineering or grammar constraints.

---

## 2. System Prompt Structure for OpenAI-Format Function Calling

### Hermes-2-Pro Format (Recommended for Open Models)

The Hermes models use ChatML with XML-delimited tool definitions and calls:

```
<|im_start|>system
You are a function calling AI model. You are provided with function signatures
within <tools></tools> XML tags. You may call one or more functions to assist
with the user query. Don't make assumptions about what values to plug into
functions. Here are the available tools:
<tools>
[{"type": "function", "function": {"name": "get_weather", "description": "Get current weather", "parameters": {"type": "object", "properties": {"city": {"type": "string"}}, "required": ["city"]}}}]
</tools>
For each function call return a json object with function name and arguments
within <tool_call></tool_call> XML tags:
<tool_call>
{"name": "<function-name>", "arguments": <args-dict>}
</tool_call>
<|im_end|>
```

### Tool Call Response Format

```
<|im_start|>tool
<tool_response>
{"name": "get_weather", "content": {"temperature": 72, "condition": "sunny"}}
</tool_response>
<|im_end|>
```

### OpenAI-Compatible Format (for models that support it)

WebLLM exposes an OpenAI-compatible API. For models with native tool support:

```javascript
const response = await engine.chat.completions.create({
  messages: [...],
  tools: [{
    type: "function",
    function: {
      name: "search_web",
      description: "Search the web for information",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"]
      }
    }
  }],
  tool_choice: "auto"
});
```

### System Prompt Best Practices for Small Models

1. **Be extremely explicit.** State exactly when to call tools vs respond directly.
2. **Put guidance in function descriptions.** The description field is the best place to clarify invocation criteria and argument construction.
3. **Use enums and constrained types.** Make invalid states unrepresentable in the schema.
4. **Specify output format inline.** Don't assume the model knows JSON schema — show the exact shape.
5. **Include a "do not call" instruction.** Small models over-trigger tool calls. Explicitly state when NOT to use a tool.
6. **Keep the system prompt under 500 tokens.** Every token of system prompt reduces available context for conversation.

---

## 3. Conversation Summarization for Limited Context Windows

### The Problem

Small models have 2K-8K token context windows. An agent loop generates growing context with each turn: system prompt + tools + conversation + tool results. This fills up fast.

### Strategy: Summary Buffer Memory (Recommended)

Keep recent messages verbatim, summarize older ones. This is the most practical approach for small models.

```
[System Prompt + Tools]          ~300-500 tokens (fixed)
[Conversation Summary]           ~200-400 tokens (compressed history)
[Recent Messages (last 2-4)]     ~500-1500 tokens (verbatim)
[Current User Message]           ~100-500 tokens
[Available for generation]       remaining tokens
```

**Implementation:**
1. Track token count of all messages
2. When total exceeds threshold (e.g., 70% of context window), trigger compaction
3. Take all messages except the last N turns
4. Summarize them into a compact block
5. Replace old messages with the summary
6. Continue conversation

### Strategy: Progressive Summarization

For very long interactions, summarize in layers:
- **Level 0:** Raw messages
- **Level 1:** Summarize every 5-10 turns into a paragraph
- **Level 2:** Summarize Level 1 summaries into key points

### Strategy: Observation Masking

Instead of LLM summarization, simply truncate or hide older tool results (which are often the largest tokens). Keep the tool call names and a brief note, but drop verbose outputs.

**This is cheaper than re-summarizing with the LLM itself** and works well when tool outputs are the primary context hog.

### What to Preserve in Summaries

- User's original goal/intent
- Key decisions made
- Current state of multi-step tasks
- Error states and what was tried
- Tool results that are still relevant

### What to Discard

- Redundant greetings/acknowledgments
- Raw tool outputs once processed
- Failed attempts (keep only the lesson learned)
- Verbose intermediate reasoning

### Compaction Prompt Template

```
Summarize the following conversation for an AI assistant to continue the task.
Preserve: the user's goal, decisions made, current progress, and any errors.
Omit: greetings, redundant details, raw data already processed.
Keep the summary under 300 tokens.

CONVERSATION:
{messages}
```

**Critical note:** If using the same small model for summarization, the summary quality will be limited. Consider a dedicated smaller/faster model for summarization, or use rule-based truncation instead.

---

## 4. Agent Handoff Patterns

### OpenAI Swarm Pattern (Recommended)

The simplest and most robust handoff pattern. Each agent is defined by:
- **name**: identifier
- **instructions**: system prompt (becomes THE system prompt when active)
- **tools**: available functions
- **handoff functions**: `transfer_to_X()` functions that return an Agent object

**How it works:**
1. Only ONE agent is active at a time
2. The active agent's instructions are the system prompt
3. When the agent calls `transfer_to_agent_X`, the system swaps to agent X
4. The full message history carries over (the new agent sees everything)
5. A transfer message is injected: "Transferred to [Agent Name]. Adopt persona immediately."

**Why this works for small models:**
- Only one system prompt at a time (less confusion)
- Handoffs are just tool calls (the model already knows how to call tools)
- No complex routing logic needed
- Each agent has a focused, short instruction set

### Implementation Skeleton

```
Agent {
  name: string
  instructions: string
  tools: Tool[]
}

AgentLoop(agent, messages):
  while true:
    response = llm.chat(
      system: agent.instructions,
      messages: messages,
      tools: agent.tools + agent.handoff_tools
    )

    if response has tool_calls:
      for each tool_call:
        result = execute(tool_call)
        if result is Agent:
          agent = result  // HANDOFF
          messages.push({role: "system", content: "Transferred to " + agent.name})
        else:
          messages.push({role: "tool", content: result})
    else:
      return response.content  // Final answer
```

### Key Design Decisions

- **Stateless between calls.** Every handoff must include all context the next agent needs in the message history. No hidden state.
- **Handoff tools are explicit.** Define `transfer_to_coder()`, `transfer_to_researcher()` as actual tool definitions so the model can reason about when to use them.
- **Keep agent count small.** For small models, 2-4 specialized agents max. More agents = more handoff confusion.
- **Coordinator pattern.** One "router" agent decides which specialist to hand off to. Specialists hand back to the router when done.

### Failure Modes to Guard Against

- **Ping-pong handoffs:** Agent A hands to B, B hands back to A. Add a "no immediate return" rule or cooldown.
- **Lost context:** After handoff, the new agent ignores conversation history. Mitigate by injecting a brief context summary at handoff.
- **Handoff with wrong agent:** Small models may pick the wrong specialist. Keep agent descriptions very distinct.

---

## 5. Few-Shot Examples for Tool Call Accuracy

### Format: Message-Based (Not String-Based)

Few-shot examples should be injected as **actual message objects** between system prompt and user message, not appended as text to the system prompt. This format works significantly better, especially with instruction-tuned models.

### Optimal Count: 3 Examples

Research shows 3 well-selected examples match or exceed 9 examples. Diminishing returns after 3. For small models with limited context, this is ideal — 3 examples use ~300-600 tokens.

### Example Structure

Each example should be a complete tool-calling trajectory:

```json
[
  {"role": "user", "content": "What's the weather in Paris?"},
  {"role": "assistant", "content": null, "tool_calls": [
    {"id": "call_1", "type": "function", "function": {"name": "get_weather", "arguments": "{\"city\": \"Paris\"}"}}
  ]},
  {"role": "tool", "content": "{\"temperature\": 18, \"condition\": \"cloudy\"}", "tool_call_id": "call_1"},
  {"role": "assistant", "content": "It's currently 18C and cloudy in Paris."}
]
```

### For Hermes-Style Models (ChatML)

```
<|im_start|>user
What's the weather in Paris?<|im_end|>
<|im_start|>assistant
<tool_call>
{"name": "get_weather", "arguments": {"city": "Paris"}}
</tool_call><|im_end|>
<|im_start|>tool
<tool_response>
{"name": "get_weather", "content": {"temperature": 18, "condition": "cloudy"}}
</tool_response><|im_end|>
<|im_start|>assistant
It's currently 18C and cloudy in Paris.<|im_end|>
```

### Selection Strategy

- **For diverse inputs:** Use semantic similarity to select the most relevant examples dynamically (e.g., embed the user query and find the closest example).
- **For focused domains:** Use a fixed set of 3 examples covering the most common tool calls.
- **Always include one "no tool needed" example** showing the model responding directly without calling a tool. This prevents over-triggering.
- **Include one multi-step example** showing a tool call, result, then a follow-up tool call.

### Performance Impact

- Claude 3 Haiku: 11% -> 75% accuracy with 3 message-based examples
- Deepseek-Coder: 7.34% -> 89.38% JSON parsability with few-shot
- Even naive few-shotting helps most models significantly

---

## 6. Handling Malformed Tool Calls (Error Recovery)

### Common Failures from Small Models

1. **Invalid JSON:** Missing quotes, trailing commas, unescaped characters
2. **Wrong schema:** Correct JSON but missing required fields or wrong types
3. **Tool name hallucination:** Calling a tool that doesn't exist
4. **Arguments hallucination:** Inventing parameter names not in the schema
5. **Incomplete generation:** Truncated JSON due to max_tokens limit
6. **Mixed output:** Tool call JSON mixed with natural language text

### Recovery Strategy Stack (in order of preference)

#### Level 1: Regex/Parser Extraction
Before JSON parsing, extract the tool call from surrounding text:
```javascript
// Extract JSON from <tool_call> tags or markdown code blocks
const match = output.match(/<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/);
// Or from ```json blocks
const match2 = output.match(/```json?\s*([\s\S]*?)\s*```/);
```

#### Level 2: JSON Repair
Use a JSON repair library to fix common issues:
- Missing closing brackets/braces
- Trailing commas
- Single quotes instead of double quotes
- Unquoted keys
- Comments in JSON

Libraries: `json_repair` (Python), `jsonrepair` (npm) or a custom fixer.

#### Level 3: Schema Validation
After parsing, validate against the tool schema:
```javascript
// Check tool name exists
if (!tools.find(t => t.name === parsed.name)) {
  return { error: "Unknown tool: " + parsed.name };
}
// Check required params
for (const req of tool.required) {
  if (!(req in parsed.arguments)) {
    return { error: "Missing required parameter: " + req };
  }
}
```

#### Level 4: Retry with Error Feedback
Feed the error back to the model as a tool response:
```json
{"role": "tool", "content": "Error: Invalid tool call. Missing required parameter 'city'. Please retry with: {\"name\": \"get_weather\", \"arguments\": {\"city\": \"<value>\"}}"}
```

This is the most effective recovery method — the model sees its mistake and self-corrects. **Limit retries to 2-3 attempts** to avoid infinite loops.

#### Level 5: Fallback to Direct Response
If all retries fail, strip the tool definitions and ask the model to respond directly:
```json
{"role": "system", "content": "Tool calling failed. Please respond to the user's question directly without using any tools."}
```

### Implementation Pattern

```
function processToolCall(output, tools, retryCount = 0):
  MAX_RETRIES = 2

  // Level 1: Extract
  extracted = extractToolCallJSON(output)
  if not extracted:
    if retryCount < MAX_RETRIES:
      return retry("Your response was not a valid tool call. Use the format: <tool_call>{...}</tool_call>")
    return fallbackDirectResponse()

  // Level 2: Repair
  repaired = jsonRepair(extracted)

  // Level 3: Parse + Validate
  try:
    parsed = JSON.parse(repaired)
    validate(parsed, tools)
  catch error:
    if retryCount < MAX_RETRIES:
      return retry("Tool call error: " + error.message)
    return fallbackDirectResponse()

  // Level 4: Execute
  result = executeTool(parsed)
  return result
```

### Prevention (Better Than Recovery)

- **Grammar-constrained decoding:** If WebLLM supports it, constrain the output to valid JSON matching the tool schema. This eliminates malformed output entirely.
- **Structured output mode:** Use JSON mode when available to force valid JSON.
- **Shorter, simpler schemas:** Fewer parameters = fewer chances for errors.
- **Temperature = 0:** For tool calls, use temperature 0 to reduce randomness.

---

## 7. Agent Loop Architecture (Putting It All Together)

### Recommended Architecture for WebLLM

```
                    +------------------+
                    |   User Message   |
                    +--------+---------+
                             |
                    +--------v---------+
                    |   Router Agent   |  (decides: respond directly or hand off)
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v---+  +------v-----+  +-----v------+
     | Code Agent |  | Search     |  | General    |
     | (sandbox)  |  | Agent      |  | Chat Agent |
     +-----------+   +------------+  +------------+
```

### The Core Loop

```
function agentLoop(initialAgent, userMessage):
  agent = initialAgent
  messages = loadHistory()  // with summarization applied
  messages.push({role: "user", content: userMessage})

  maxIterations = 10
  iteration = 0

  while iteration < maxIterations:
    iteration++

    // Check context budget
    if tokenCount(messages) > CONTEXT_BUDGET:
      messages = compactMessages(messages)

    // Call LLM
    response = await engine.chat.completions.create({
      messages: [{role: "system", content: agent.instructions}, ...messages],
      tools: [...agent.tools, ...agent.handoffTools],
      temperature: 0,  // for tool calls
    })

    choice = response.choices[0]

    // No tool calls = final response
    if not choice.message.tool_calls:
      messages.push(choice.message)
      saveHistory(messages)
      return choice.message.content

    // Process tool calls
    messages.push(choice.message)
    for each toolCall in choice.message.tool_calls:
      result = executeWithRecovery(toolCall, agent.tools)

      if result is Agent:  // Handoff
        agent = result
        messages.push({role: "tool", content: "Transferred to " + agent.name})
      else:
        messages.push({role: "tool", content: JSON.stringify(result), tool_call_id: toolCall.id})

  // Max iterations reached
  return "I was unable to complete the task. Please try rephrasing your request."
```

### Key Design Principles

1. **Single active agent.** Only one system prompt at a time. Reduces confusion for small models.
2. **Stateless between user messages.** Serialize full state to history. No in-memory hidden state.
3. **Aggressive context management.** Compact early and often. Budget tokens explicitly.
4. **Fail fast, fail gracefully.** Max iteration limits. Error recovery with fallback. Never hang.
5. **Temperature 0 for tool calls.** Use higher temperature only for creative final responses.
6. **Few-shot examples baked into system prompt.** 2-3 examples of correct tool call format.

---

## 8. WebLLM-Specific Considerations

### Current State of WebLLM Tool Calling

- WebLLM has **preliminary/WIP** support for function calling via `tools` and `tool_choice` fields
- Manual function calling (parsing tool calls from text output) is more reliable for now
- The engine is OpenAI API-compatible: `engine.chat.completions.create()`
- Runs in a Web Worker to avoid blocking the UI thread

### Architecture: Main Thread + Worker

```
Main Thread (UI)                    Worker Thread (Inference)
+------------------+                +------------------+
| ServiceWorker    |  <-- msgs -->  | MLCEngine        |
| MLCEngine        |                | (actual compute) |
| (lightweight)    |                | WebGPU accel.    |
+------------------+                +------------------+
```

### Context Window Sizes (Typical for 4-bit Quantized)

| Model | Context Window | Effective Budget* |
|-------|---------------|-------------------|
| Llama-3-8B | 8192 tokens | ~6000 tokens |
| Mistral-7B | 8192 tokens | ~6000 tokens |
| Phi-3-mini (3.8B) | 4096 tokens | ~3000 tokens |
| Qwen2-1.5B | 2048 tokens | ~1500 tokens |
| Gemma-2B | 2048 tokens | ~1500 tokens |

*Effective budget = total context minus system prompt, tools, and few-shot examples

### Performance Expectations

- 8B models at 4-bit: ~10-30 tokens/sec on modern GPU (varies by device)
- 3B models at 4-bit: ~20-50 tokens/sec
- 1-2B models: ~30-80 tokens/sec
- First load: several seconds to minutes (model download + compilation)

### Manual Tool Call Parsing (Recommended Approach)

Since WebLLM's native tool calling is WIP, implement manual parsing:

```javascript
// 1. Include tool format in system prompt (Hermes style)
// 2. Get raw text completion
// 3. Parse tool calls from output text
// 4. Execute tools
// 5. Feed results back as messages
// 6. Continue loop
```

---

## Sources

- [Optimizing Function Calling with SLMs - Microsoft](https://medium.com/data-science-at-microsoft/optimizing-function-calling-with-small-language-models-data-quality-quantity-and-practical-353be49b7a00)
- [Small Models, Big Tasks - ACM/arXiv](https://arxiv.org/abs/2504.19277)
- [Improving LLM Function Calling via Guided-Structured Templates](https://arxiv.org/html/2509.18076v1)
- [Few-Shot Prompting for Tool Calling - LangChain](https://blog.langchain.com/few-shot-prompting-to-improve-tool-calling-performance/)
- [OpenAI Function Calling Guide](https://developers.openai.com/api/docs/guides/function-calling)
- [Effective Context Engineering for AI Agents - Anthropic](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents)
- [Context Packing for Small Models - Docker](https://www.docker.com/blog/context-packing-context-window/)
- [Progressive Summarization with Limited Context](https://medium.com/@auslei/progressive-summarisation-using-llm-with-limited-context-window-e160f5041316)
- [Orchestrating Agents: Routines and Handoffs - OpenAI](https://developers.openai.com/cookbook/examples/orchestrating_agents)
- [OpenAI Swarm Framework](https://github.com/openai/swarm)
- [Hermes-2-Pro Function Calling](https://github.com/NousResearch/Hermes-Function-Calling)
- [WebLLM - MLC-AI](https://github.com/mlc-ai/web-llm)
- [AgentLLM - Browser-Native Agents](https://github.com/idosal/AgentLLM)
- [Handling Parsing Errors in LLM Agents](https://apxml.com/courses/prompt-engineering-llm-application-development/chapter-7-output-parsing-validation-reliability/handling-parsing-errors)
- [json_repair Library](https://github.com/mangiucugna/json_repair)
- [Error Recovery and Fallback Strategies](https://www.gocodeo.com/post/error-recovery-and-fallback-strategies-in-ai-agent-development)
- [JetBrains Research: Efficient Context Management](https://blog.jetbrains.com/research/2025/12/efficient-context-management/)
- [Fine-Tuning SLMs for Function Calling - Microsoft](https://techcommunity.microsoft.com/blog/machinelearningblog/fine-tuning-small-language-models-for-function-calling-a-comprehensive-guide/4362539)
- [Tool Calling with Llama 3.2](https://medium.com/@stephan.pirner93/tool-calling-with-llama-3-2-23e3d783a6d8)
- [Google AI Edge: On-Device SLMs](https://developers.googleblog.com/google-ai-edge-small-language-models-multimodality-rag-function-calling/)
