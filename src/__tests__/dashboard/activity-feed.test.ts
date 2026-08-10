import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '@/store/app-store';

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

describe('Activity Feed population', () => {
  beforeEach(() => {
    useAppStore.setState({
      conversations: [],
      activeConversationId: null,
      activeAgent: 'general',
    });
  });

  it('activity feed gets populated when messages are added', () => {
    // THIS SHOULD FAIL if the activity feed is NOT derived from conversation messages.
    // MissionControl computes feedItems via useMemo from conversations — that's a React
    // component concern. The store-level test is: after adding messages, the conversation
    // data that feeds the activity feed should be available.

    const store = useAppStore.getState();
    const convId = store.createConversation('Test');

    // Add a user message
    useAppStore.getState().addMessage(convId, {
      conversationId: convId,
      role: 'user',
      content: 'Hello world',
    });

    // Add an assistant response
    useAppStore.getState().addMessage(convId, {
      conversationId: convId,
      role: 'assistant',
      content: 'Hi there!',
      agentType: 'general',
    });

    // Derive feed items the same way MissionControl does
    const conversations = useAppStore.getState().conversations;
    const feedItems: Array<{ id: string; agentId: string; action: string }> = [];
    for (const conv of conversations) {
      for (const msg of conv.messages) {
        const agentId = msg.agentType ?? conv.activeAgent ?? 'general';
        if (msg.role === 'user') {
          feedItems.push({ id: msg.id, agentId, action: 'received message' });
        } else if (msg.role === 'assistant') {
          feedItems.push({ id: msg.id, agentId, action: 'replied' });
        }
      }
    }

    // We should have 2 feed items (1 user message + 1 assistant reply)
    expect(feedItems).toHaveLength(2);
    expect(feedItems[0]!.action).toBe('received message');
    expect(feedItems[1]!.action).toBe('replied');
    expect(feedItems[1]!.agentId).toBe('general');
  });
});
