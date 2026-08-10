import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '@/store/app-store';
import { toolRegistry } from '@/tools/registry';

// Mock DB repos
vi.mock('@/db/repositories/conversations', () => ({
  conversationRepo: {
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/db/repositories/messages', () => ({
  messageRepo: {
    add: vi.fn().mockResolvedValue(undefined),
    getByConversation: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/db/schema', () => ({
  requestPersistentStorage: vi.fn().mockResolvedValue(undefined),
}));

describe('Chat Flow Integration', () => {
  beforeEach(() => {
    useAppStore.setState({
      conversations: [],
      activeConversationId: null,
      activeAgent: 'general',
    });
  });

  it.skip('sending a message should trigger an LLM response', async () => {
    // SKIPPED: The real flow goes through useChat().sendMessage(), a React hook
    // that wires chat input -> orchestrator -> LLM. Testing this requires either
    // component rendering with renderHook() or a full orchestrator mock.
    // This will be enabled once the sendMessage integration is testable.

    const store = useAppStore.getState();
    const convId = store.createConversation('Test');

    useAppStore.getState().addMessage(convId, {
      conversationId: convId,
      role: 'user',
      content: 'Hello',
    });

    await new Promise((r) => setTimeout(r, 100));

    const conv = useAppStore.getState().conversations.find((c) => c.id === convId);
    const assistantMessages = conv?.messages.filter((m) => m.role === 'assistant') ?? [];
    expect(assistantMessages.length).toBeGreaterThan(0);
  });

  it('tool toggles affect which tools the orchestrator uses', () => {
    // Verify that the tool registry respects enabled tool filtering
    // This tests the registry's getEnabledToolsForAgent method

    // Register a couple mock tools
    toolRegistry.register({
      id: 'tool_a',
      name: 'Tool A',
      description: 'A',
      parameters: {},
      availableTo: ['general'],
      execute: vi.fn(),
    });
    toolRegistry.register({
      id: 'tool_b',
      name: 'Tool B',
      description: 'B',
      parameters: {},
      availableTo: ['general'],
      execute: vi.fn(),
    });

    // With no filter, all tools should be returned
    const allTools = toolRegistry.getEnabledToolsForAgent('general');
    const toolIds = allTools.map((t) => t.id);
    expect(toolIds).toContain('tool_a');
    expect(toolIds).toContain('tool_b');

    // With a filter, only enabled tools should be returned
    const filteredTools = toolRegistry.getEnabledToolsForAgent('general', new Set(['tool_a']));
    const filteredIds = filteredTools.map((t) => t.id);
    expect(filteredIds).toContain('tool_a');
    expect(filteredIds).not.toContain('tool_b');
  });
});
