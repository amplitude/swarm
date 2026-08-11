/**
 * response-parser-live.test.ts — Response parser integration test
 *
 * Tests the production parseToolCalls() on various response formats.
 * The live Ollama integration tests have been removed since WebLLM is
 * the only production provider. See response-parser.test.ts for the
 * complete parser unit test suite.
 */

import { describe, it, expect } from 'vitest';
import { parseToolCalls } from '@/llm/response-parser';
import { getModelCapabilities } from '@/llm/model-capabilities';

describe('response-parser.ts (unit — real module)', () => {
  const caps = getModelCapabilities('SmolLM2-135M-Instruct-q0f16-MLC');

  it('parses {"tool_call": {"name": "...", "arguments": {...}}} format', () => {
    const content = [
      'I\'ll look up the weather and do the calculation.',
      '{"tool_call": {"name": "get_weather", "arguments": {"location": "Tokyo", "unit": "celsius"}}}',
      '{"tool_call": {"name": "calculator", "arguments": {"expression": "15 * 37"}}}',
    ].join('\n');

    const { toolCalls } = parseToolCalls(content, caps);
    expect(toolCalls).toHaveLength(2);
    expect(toolCalls[0]!.function.name).toBe('get_weather');
    expect(toolCalls[1]!.function.name).toBe('calculator');
    const args1 = JSON.parse(toolCalls[0]!.function.arguments);
    expect(args1.location).toBe('Tokyo');
    const args2 = JSON.parse(toolCalls[1]!.function.arguments);
    expect(args2.expression).toBe('15 * 37');
  });

  it('parses {"name": "...", "arguments": {...}} format', () => {
    const content = '{"name": "get_weather", "arguments": {"location": "London"}}';
    const { toolCalls } = parseToolCalls(content, caps);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.function.name).toBe('get_weather');
  });

  it('strips markdown code fences containing JSON', () => {
    const content = '```json\n{"tool_call": {"name": "calculator", "arguments": {"expression": "2+2"}}}\n```';
    const { toolCalls } = parseToolCalls(content, caps);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.function.name).toBe('calculator');
  });

  it('handles JSON repair (trailing commas, single quotes)', () => {
    const content = "{'tool_call': {'name': 'get_weather', 'arguments': {'location': 'Paris',},}}";
    const { toolCalls } = parseToolCalls(content, caps);
    expect(toolCalls).toHaveLength(1);
    expect(toolCalls[0]!.function.name).toBe('get_weather');
    const args = JSON.parse(toolCalls[0]!.function.arguments);
    expect(args.location).toBe('Paris');
  });

  it('returns empty array for text without tool calls', () => {
    const content = 'The weather in Tokyo is 22°C and 15 × 37 = 555.';
    const { toolCalls } = parseToolCalls(content, caps);
    expect(toolCalls).toHaveLength(0);
  });
});
