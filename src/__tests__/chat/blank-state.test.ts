import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '@/store/app-store';

// Mock repositories
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

describe('Blank slate / first run', () => {
  beforeEach(() => {
    useAppStore.setState({
      conversations: [],
      activeConversationId: null,
      activeAgent: 'general',
      llmStatus: 'idle',
      llmModelName: null,
      llmError: null,
    });
  });

  it('starts with zero conversations', () => {
    const state = useAppStore.getState();
    expect(state.conversations).toHaveLength(0);
    expect(state.activeConversationId).toBeNull();
  });

  it('creates a conversation when user sends first message', () => {
    const convId = useAppStore.getState().createConversation('My first message', 'general');

    const state = useAppStore.getState();
    expect(convId).toBeTruthy();
    expect(state.conversations).toHaveLength(1);
    expect(state.conversations[0]!.title).toBe('My first message');
    expect(state.conversations[0]!.activeAgent).toBe('general');
  });

  it('new conversation per agent maintains separate histories', () => {
    // Create conversation for 'general' agent
    const generalId = useAppStore.getState().createConversation('General chat', 'general');
    useAppStore.getState().addMessage(generalId, {
      conversationId: generalId,
      role: 'user',
      content: 'Hello from general',
    });

    // Now create another conversation — same agent gets a new one
    const generalId2 = useAppStore.getState().createConversation('Second general chat', 'general');
    expect(generalId2).not.toBe(generalId);

    // The conversation slice allows multiple conversations per agent
    const generalConvs = useAppStore.getState().conversations.filter((c) => c.activeAgent === 'general');
    expect(generalConvs).toHaveLength(2);
  });

  it('LLM starts idle with no model loaded', () => {
    const state = useAppStore.getState();
    expect(state.llmStatus).toBe('idle');
    expect(state.llmModelName).toBeNull();
    expect(state.llmError).toBeNull();
    expect(state.llmProgress).toBe(0);
  });

  it('stats are zeroed on initial state', () => {
    const state = useAppStore.getState();
    expect(state.tokensPerSecond).toBe(0);
    expect(state.vramUsageMB).toBe(0);
  });

  it('can create and delete a conversation (clean slate round-trip)', () => {
    // Create conversation
    const convId = useAppStore.getState().createConversation('Temporary', 'general');
    expect(useAppStore.getState().conversations).toHaveLength(1);

    // Add a message
    useAppStore.getState().addMessage(convId, {
      conversationId: convId,
      role: 'user',
      content: 'Test',
    });

    // Delete it
    useAppStore.getState().deleteConversation(convId);
    expect(useAppStore.getState().conversations).toHaveLength(0);
    expect(useAppStore.getState().activeConversationId).toBeNull();
  });

  it('hydrateConversations with empty DB keeps blank state', async () => {
    // With mocked repos returning empty arrays, hydration should keep zero conversations
    await useAppStore.getState().hydrateConversations();
    const state = useAppStore.getState();
    expect(state.conversations).toHaveLength(0);
    expect(state.activeConversationId).toBeNull();
  });
});
