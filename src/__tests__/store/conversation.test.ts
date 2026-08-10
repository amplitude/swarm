import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAppStore, switchAgent } from '@/store/app-store';

// Mock Dexie repos so we don't need IndexedDB in tests
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

describe('Conversation Store', () => {
  beforeEach(() => {
    // Reset store state between tests
    useAppStore.setState({
      conversations: [],
      activeConversationId: null,
      activeAgent: 'general',
    });
  });

  it('creates a conversation and adds messages', () => {
    const store = useAppStore.getState();
    const convId = store.createConversation('Test Chat');

    expect(convId).toBeTruthy();
    expect(useAppStore.getState().conversations).toHaveLength(1);
    expect(useAppStore.getState().conversations[0]!.title).toBe('Test Chat');

    // Add a message
    useAppStore.getState().addMessage(convId, {
      conversationId: convId,
      role: 'user',
      content: 'Hello world',
    });

    const conv = useAppStore.getState().conversations.find((c) => c.id === convId);
    expect(conv?.messages).toHaveLength(1);
    expect(conv?.messages[0]!.content).toBe('Hello world');
    expect(conv?.messages[0]!.id).toBeTruthy();
    expect(conv?.messages[0]!.timestamp).toBeGreaterThan(0);
  });

  it('switching agents should show different conversations', () => {
    // This test verifies that each agent has its own conversation history.
    // KNOWN BUG: Currently all agents share the same conversation.
    // This test SHOULD FAIL until the bug is fixed.

    // Create a conversation with 'general' agent
    switchAgent('general');
    const store = useAppStore.getState();
    const convId = store.createConversation('General Chat', 'general');
    useAppStore.getState().addMessage(convId, {
      conversationId: convId,
      role: 'user',
      content: 'Message to general',
    });

    // Switch to 'coder' agent using standalone switchAgent (which filters conversations by agent)
    switchAgent('coder');

    // After switching agents, a new conversation context should be active
    // or the active conversation should change to one associated with the coder agent.
    // The current conversation's messages should NOT contain the general agent's messages
    // when viewed through the coder agent's lens.
    const coderConv = useAppStore.getState().getActiveConversation();

    // BUG: Currently the same conversation stays active for all agents.
    // Expected behavior: switching agents gives a separate conversation
    // (or at minimum, the activeConversationId changes).
    const generalConv = useAppStore.getState().conversations.find((c) => c.id === convId);

    // The active agent should be 'coder' now
    expect(useAppStore.getState().activeAgent).toBe('coder');

    // This assertion tests the expected fix: switching agents should either
    // create a new conversation or switch to a different one.
    // Currently this will FAIL because the activeConversationId doesn't change.
    expect(coderConv?.id).not.toBe(generalConv?.id);
  });

  it('persists conversations to IndexedDB via write-through', async () => {
    const { conversationRepo } = await import('@/db/repositories/conversations');
    const { messageRepo } = await import('@/db/repositories/messages');

    const store = useAppStore.getState();
    const convId = store.createConversation('Persisted Chat');

    // conversationRepo.create should have been called
    expect(conversationRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        id: convId,
        title: 'Persisted Chat',
      }),
    );

    // Add a message
    useAppStore.getState().addMessage(convId, {
      conversationId: convId,
      role: 'user',
      content: 'Persist me',
    });

    // messageRepo.add should have been called
    expect(messageRepo.add).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: convId,
        content: 'Persist me',
      }),
    );

    // conversationRepo.update should have been called with updated timestamp
    expect(conversationRepo.update).toHaveBeenCalledWith(
      convId,
      expect.objectContaining({ updatedAt: expect.any(Number) }),
    );
  });
});
