import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Orchestrator } from '@/agents/orchestrator';
import type { LLMChat, LLMChatResponse } from '@/agents/orchestrator';
import type { ToolExecutor, ToolResult } from '@/types/tool';
import type { Message } from '@/types/message';

// Mock the tool registry so it returns tools for agents
vi.mock('@/tools/registry', () => {
  const handoffTool = {
    id: 'handoff_to_agent',
    name: 'Handoff',
    description: 'Hand off to another agent',
    parameters: { type: 'object', properties: { target_agent: { type: 'string' }, reason: { type: 'string' }, context: { type: 'string' } } },
    availableTo: ['general', 'coder', 'pm', 'designer'],
    execute: vi.fn(),
  };
  const mockTool = {
    id: 'run_javascript',
    name: 'Run JavaScript',
    description: 'Execute JavaScript code',
    parameters: { type: 'object', properties: { code: { type: 'string' } } },
    availableTo: ['general', 'coder', 'pm', 'designer'],
    execute: vi.fn(),
  };
  return {
    toolRegistry: {
      getEnabledToolsForAgent: vi.fn().mockReturnValue([handoffTool, mockTool]),
      getToolsForAgent: vi.fn().mockReturnValue([handoffTool, mockTool]),
      get: vi.fn((id: string) => id === 'handoff_to_agent' ? handoffTool : mockTool),
      has: vi.fn().mockReturnValue(true),
    },
  };
});

function createMockLLM(responses: LLMChatResponse[]): LLMChat {
  let callIndex = 0;
  return {
    chatCompletion: vi.fn().mockImplementation(async () => {
      return responses[callIndex++] ?? { content: '', finishReason: 'stop' };
    }),
  };
}

function createMockToolExecutor(): ToolExecutor {
  return {
    execute: vi.fn().mockResolvedValue({
      success: true,
      output: 'tool result',
    } satisfies ToolResult),
  };
}

function makeMessage(content: string, role: 'user' | 'assistant' = 'user'): Message {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    role,
    content,
    timestamp: Date.now(),
  };
}

describe('Orchestrator', () => {
  let mockExecutor: ToolExecutor;

  beforeEach(() => {
    mockExecutor = createMockToolExecutor();
  });

  it('calls LLM and returns a response', async () => {
    const llm = createMockLLM([
      { content: 'Hello! How can I help?', finishReason: 'stop', toolCalls: undefined },
    ]);
    const orchestrator = new Orchestrator(llm, mockExecutor);

    const turn = await orchestrator.runTurn([makeMessage('Hi')], 'general');

    expect(turn.finalResponse).toBe('Hello! How can I help?');
    expect(turn.agentId).toBe('general');
    expect(turn.messages.length).toBeGreaterThan(0);
    expect(llm.chatCompletion).toHaveBeenCalledOnce();
  });

  it('executes tool calls and loops back', async () => {
    const llm = createMockLLM([
      // First call: LLM wants to use a tool
      {
        content: null,
        finishReason: 'tool_calls',
        toolCalls: [{
          id: 'tc-1',
          function: { name: 'run_javascript', arguments: '{"code":"1+1"}' },
        }],
      },
      // Second call: LLM gives final response after seeing tool result
      { content: 'The result is 2.', finishReason: 'stop', toolCalls: undefined },
    ]);

    const orchestrator = new Orchestrator(llm, mockExecutor);
    const turn = await orchestrator.runTurn([makeMessage('Calculate 1+1')], 'coder');

    expect(turn.finalResponse).toBe('The result is 2.');
    expect(turn.toolCalls).toHaveLength(1);
    expect(turn.toolCalls[0]!.toolId).toBe('run_javascript');
    expect(mockExecutor.execute).toHaveBeenCalledWith('run_javascript', { code: '1+1' });
    expect(turn.iterations).toBe(2);
  });

  it('stops on handoff and returns pendingHandoff', async () => {
    const llm = createMockLLM([
      {
        content: null,
        finishReason: 'tool_calls',
        toolCalls: [{
          id: 'tc-handoff',
          function: {
            name: 'handoff_to_agent',
            arguments: JSON.stringify({
              target_agent: 'coder',
              reason: 'This needs code',
              context: 'User wants a function',
            }),
          },
        }],
      },
    ]);

    const onHandoffProposed = vi.fn();
    const orchestrator = new Orchestrator(llm, mockExecutor, { onHandoffProposed });
    const turn = await orchestrator.runTurn([makeMessage('Write a function')], 'general');

    // The loop should STOP -- not auto-recurse
    expect(turn.pendingHandoff).toBeDefined();
    expect(turn.pendingHandoff!.toAgent).toBe('coder');
    expect(turn.pendingHandoff!.fromAgent).toBe('general');
    expect(turn.pendingHandoff!.status).toBe('pending');
    expect(turn.finalResponse).toBeUndefined();
    expect(onHandoffProposed).toHaveBeenCalledOnce();

    // The tool executor should NOT have been called for handoff
    expect(mockExecutor.execute).not.toHaveBeenCalled();
  });

  it('approveHandoff switches agent and provides context', () => {
    const orchestrator = new Orchestrator(
      createMockLLM([]),
      mockExecutor,
    );

    const proposal = {
      id: 'hp-1',
      fromAgent: 'general' as const,
      toAgent: 'coder' as const,
      reason: 'Code task',
      context: 'User wants a sorting function',
      status: 'pending' as const,
    };

    const result = orchestrator.approveHandoff(proposal, 'conv-1');

    expect(result.newAgent).toBe('coder');
    expect(result.messages.length).toBeGreaterThan(0);
    // The context message should mention the handoff
    expect(result.messages[0]!.role).toBe('system');
    expect(result.messages[0]!.content).toContain('Handoff');
    expect(proposal.status).toBe('approved');
  });

  it('rejectHandoff keeps current agent', () => {
    const orchestrator = new Orchestrator(
      createMockLLM([]),
      mockExecutor,
    );

    const proposal = {
      id: 'hp-2',
      fromAgent: 'general' as const,
      toAgent: 'coder' as const,
      reason: 'Code task',
      context: '',
      status: 'pending' as const,
    };

    const result = orchestrator.rejectHandoff(proposal, 'conv-1');

    // No newAgent returned -- the caller keeps using the same agent
    expect(result.messages.length).toBeGreaterThan(0);
    expect(result.messages[0]!.role).toBe('system');
    expect(result.messages[0]!.content).toContain('rejected');
    expect(proposal.status).toBe('rejected');
  });
});
