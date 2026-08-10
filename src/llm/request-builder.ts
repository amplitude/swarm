import type { LLMRequest } from './engine';
import type { ModelCapabilities } from './model-capabilities';

const CHARS_PER_TOKEN = 4;

export function buildAdaptiveRequest(
  request: LLMRequest,
  capabilities: ModelCapabilities,
): LLMRequest {
  let { messages, tools, ...rest } = request;
  messages = [...messages];
  const hasTools = !!(tools && tools.length > 0);

  // Convert tools to text prompt for non-native models
  if (hasTools && capabilities.toolCallFormat === 'json-text') {
    const toolDescriptions = tools!.map((t) => {
      const fn = t.function;
      return `- ${fn.name}: ${fn.description}\n  Parameters: ${JSON.stringify(fn.parameters)}`;
    }).join('\n');

    const toolPrompt =
      `\n\nYou have access to these tools:\n\n${toolDescriptions}\n\n` +
      `To call a tool, respond with EXACTLY this JSON format on its own line:\n` +
      `{"tool_call": {"name": "<tool_name>", "arguments": {<parameters>}}}\n\n` +
      `Example tool calls:\n` +
      `{"tool_call": {"name": "search_web", "arguments": {"query": "weather today"}}}\n` +
      `{"tool_call": {"name": "create_file", "arguments": {"path": "test.txt", "content": "hello"}}}\n\n` +
      `You may call multiple tools by outputting multiple JSON objects, one per line.\n` +
      `After all tool calls, wait for results before continuing.\n` +
      `If you do not need a tool, respond normally with text.\n` +
      `IMPORTANT: Output the JSON exactly as shown. Do not wrap it in markdown code blocks.`;

    // Append to system message if one exists, otherwise prepend as system
    const systemIdx = messages.findIndex((m) => m.role === 'system');
    if (systemIdx >= 0) {
      const existing = messages[systemIdx]!;
      messages[systemIdx] = {
        role: existing.role,
        content: existing.content + toolPrompt,
        ...(existing.tool_call_id ? { tool_call_id: existing.tool_call_id } : {}),
      };
    } else {
      messages.unshift({ role: 'system', content: toolPrompt.trim() });
    }

    // Don't send tools array to the provider
    tools = undefined;
  }

  if (hasTools && capabilities.toolCallFormat === 'none') {
    tools = undefined;
  }

  // Move system prompt to user message if model doesn't support it with tools
  if (hasTools && tools && !capabilities.supportsSystemPromptWithTools) {
    const systemMsg = messages.find((m) => m.role === 'system');
    if (systemMsg) {
      const systemContent = systemMsg.content;
      messages = messages.filter((m) => m.role !== 'system');
      messages.unshift({
        role: 'user',
        content: `[System Instructions]\n${systemContent}`,
      });
    }
  }

  // Truncate if messages exceed context window
  messages = truncateToFit(messages, capabilities.maxContextTokens);

  return { ...rest, messages, tools };
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function truncateToFit(
  messages: Array<{ role: string; content: string; tool_call_id?: string }>,
  maxTokens: number,
): Array<{ role: string; content: string; tool_call_id?: string }> {
  // Reserve ~25% of context for the response
  const budget = Math.floor(maxTokens * 0.75);

  let totalTokens = 0;
  for (const m of messages) {
    totalTokens += estimateTokens(m.content);
  }

  if (totalTokens <= budget) {
    return messages;
  }

  // Keep system/first message and trim from the oldest non-system messages
  const system = messages.filter((m) => m.role === 'system');
  const nonSystem = messages.filter((m) => m.role !== 'system');

  let systemTokens = 0;
  for (const m of system) {
    systemTokens += estimateTokens(m.content);
  }

  const remaining = budget - systemTokens;
  const kept: typeof nonSystem = [];
  let usedTokens = 0;

  // Keep messages from the end (most recent first)
  for (let i = nonSystem.length - 1; i >= 0; i--) {
    const msg = nonSystem[i]!;
    const tokens = estimateTokens(msg.content);
    if (usedTokens + tokens > remaining) break;
    kept.unshift(msg);
    usedTokens += tokens;
  }

  if (kept.length < nonSystem.length) {
    console.warn(
      `Truncated ${nonSystem.length - kept.length} messages to fit context window ` +
      `(${maxTokens} tokens).`,
    );
  }

  return [...system, ...kept];
}
