import type { LLMToolCall } from './engine';
import type { ModelCapabilities } from './model-capabilities';

export function parseToolCalls(
  content: string,
  capabilities: Pick<ModelCapabilities, 'toolCallFormat'>,
): { cleanedContent: string; toolCalls: LLMToolCall[] } {
  if (capabilities.toolCallFormat !== 'json-text') {
    return { cleanedContent: content, toolCalls: [] };
  }

  const toolCalls: LLMToolCall[] = [];
  const contentLines: string[] = [];
  let callIndex = 0;

  // Strip markdown code fences if the whole response is wrapped
  let text = content;
  const fenceMatch = text.match(/^```(?:json)?\s*\n([\s\S]*?)\n```\s*$/);
  if (fenceMatch && fenceMatch[1] != null) {
    text = fenceMatch[1];
  }

  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      contentLines.push(line);
      continue;
    }

    const parsed = tryParseToolCall(trimmed);
    if (parsed) {
      toolCalls.push({
        id: `call_${callIndex++}`,
        function: {
          name: parsed.name,
          arguments: JSON.stringify(parsed.arguments),
        },
      });
    } else {
      contentLines.push(line);
    }
  }

  const cleanedContent = contentLines.join('\n').trim();
  return { cleanedContent, toolCalls };
}

function tryParseToolCall(
  text: string,
): { name: string; arguments: Record<string, unknown> } | null {
  // Remove inline code fence wrapping if present
  let raw = text;
  if (raw.startsWith('```') && raw.endsWith('```')) {
    raw = raw.slice(3, -3).replace(/^json\s*/, '');
  }

  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    // Attempt basic JSON repair: trailing commas, single quotes, unquoted keys
    const repaired = repairJson(raw);
    if (repaired) {
      try {
        obj = JSON.parse(repaired);
      } catch {
        return null;
      }
    } else {
      return null;
    }
  }

  if (typeof obj !== 'object' || obj === null) return null;

  const record = obj as Record<string, unknown>;

  // Format: {"tool_call": {"name": "...", "arguments": {...}}}
  if (record.tool_call && typeof record.tool_call === 'object') {
    const tc = record.tool_call as Record<string, unknown>;
    if (typeof tc.name === 'string') {
      return {
        name: tc.name,
        arguments: (typeof tc.arguments === 'object' && tc.arguments !== null)
          ? tc.arguments as Record<string, unknown>
          : {},
      };
    }
  }

  // Format: {"name": "...", "arguments": {...}} (direct tool call object)
  if (typeof record.name === 'string' && record.arguments !== undefined) {
    return {
      name: record.name,
      arguments: (typeof record.arguments === 'object' && record.arguments !== null)
        ? record.arguments as Record<string, unknown>
        : {},
    };
  }

  return null;
}

function repairJson(text: string): string | null {
  let s = text.trim();
  // Remove trailing commas before } or ]
  s = s.replace(/,\s*([}\]])/g, '$1');
  // Replace single quotes with double quotes (simple cases only)
  s = s.replace(/'/g, '"');
  // Quote unquoted keys: {key: -> {"key":
  s = s.replace(/([{,]\s*)([a-zA-Z_]\w*)\s*:/g, '$1"$2":');
  // Only return if we actually changed something
  return s !== text.trim() ? s : null;
}
