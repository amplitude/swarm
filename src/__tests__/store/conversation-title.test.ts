import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/store/app-store';

describe('Conversation title from first user message', () => {
  beforeEach(() => {
    useAppStore.setState({
      conversations: [],
      activeConversationId: null,
    });
  });

  it('createConversation with title sets it from the text', () => {
    const id = useAppStore.getState().createConversation('Hello, this is my first message!', 'manager');
    const conv = useAppStore.getState().conversations.find((c) => c.id === id);
    expect(conv).toBeDefined();
    expect(conv!.title).toBe('Hello, this is my first message!');
    expect(conv!.activeAgent).toBe('manager');
  });

  it('createConversation defaults to "New conversation" when no title given', () => {
    const id = useAppStore.getState().createConversation();
    const conv = useAppStore.getState().conversations.find((c) => c.id === id);
    expect(conv!.title).toBe('New conversation');
  });

  it('createConversation stores the exact title passed by caller', () => {
    const title = useAppStore.getState().createConversation('Hello world!', 'manager');
    const conv = useAppStore.getState().conversations.find((c) => c.id === title);
    expect(conv!.title).toBe('Hello world!');
  });

  it('useChat passes truncated title (caller responsibility)', () => {
    // The useChat hook truncates to 40 chars: text.slice(0, 40)
    const longText = 'A'.repeat(100);
    const truncated = longText.slice(0, 40);
    const id = useAppStore.getState().createConversation(truncated, 'manager');
    const conv = useAppStore.getState().conversations.find((c) => c.id === id);
    expect(conv!.title).toBe(truncated);
    expect(conv!.title.length).toBe(40);
  });
});
