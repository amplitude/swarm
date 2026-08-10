import type { StateCreator } from 'zustand';
import type { Conversation } from '../../types/conversation';
import type { Message } from '../../types/message';
import { nanoid } from 'nanoid';
import { conversationRepo } from '../../db/repositories/conversations';
import { messageRepo } from '../../db/repositories/messages';

export interface ConversationSlice {
  conversations: Conversation[];
  activeConversationId: string | null;

  createConversation: (title?: string, agentType?: import('../../types/agent').AgentType) => string;
  setActiveConversation: (id: string | null) => void;
  deleteConversation: (id: string) => void;
  addMessage: (conversationId: string, message: Omit<Message, 'id' | 'timestamp'>) => void;
  /** Add a pre-built message (with id/timestamp already set) */
  pushMessage: (conversationId: string, message: Message) => void;
  /** Append multiple pre-built messages at once */
  pushMessages: (conversationId: string, messages: Message[]) => void;
  /** Update the content of an existing message (for streaming tokens) */
  updateMessageContent: (conversationId: string, messageId: string, content: string) => void;
  getActiveConversation: () => Conversation | undefined;
  hydrateConversations: () => Promise<void>;
}

export const createConversationSlice: StateCreator<ConversationSlice, [], [], ConversationSlice> = (
  set,
  get,
) => ({
  conversations: [],
  activeConversationId: null,

  createConversation: (title, agentType) => {
    const id = nanoid();
    const now = Date.now();
    const conversation: Conversation = {
      id,
      title: title || 'New conversation',
      messages: [],
      activeAgent: agentType ?? 'manager',
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({
      conversations: [conversation, ...s.conversations],
      activeConversationId: id,
    }));
    conversationRepo.create(conversation).catch(console.error);
    return id;
  },

  setActiveConversation: (id) => {
    set({ activeConversationId: id });
    if (id) {
      localStorage.setItem('swarm-last-conversation', id);
    }
  },

  deleteConversation: (id) => {
    set((s) => ({
      conversations: s.conversations.filter((c) => c.id !== id),
      activeConversationId: s.activeConversationId === id ? null : s.activeConversationId,
    }));
    conversationRepo.remove(id).catch(console.error);
  },

  addMessage: (conversationId, message) => {
    const fullMessage: Message = {
      ...message,
      id: nanoid(),
      timestamp: Date.now(),
    };
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: [...c.messages, fullMessage],
              updatedAt: fullMessage.timestamp,
            }
          : c,
      ),
    }));
    // Write-through: persist message and update conversation timestamp
    messageRepo.add(fullMessage).catch(console.error);
    conversationRepo
      .update(conversationId, { updatedAt: fullMessage.timestamp })
      .catch(console.error);
  },

  pushMessage: (conversationId, message) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, message], updatedAt: message.timestamp }
          : c,
      ),
    }));
    messageRepo.add(message).catch(console.error);
    conversationRepo.update(conversationId, { updatedAt: message.timestamp }).catch(console.error);
  },

  pushMessages: (conversationId, messages) => {
    if (messages.length === 0) return;
    const updatedAt = messages[messages.length - 1]!.timestamp;
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, messages: [...c.messages, ...messages], updatedAt }
          : c,
      ),
    }));
    for (const msg of messages) {
      messageRepo.add(msg).catch(console.error);
    }
    conversationRepo.update(conversationId, { updatedAt }).catch(console.error);
  },

  updateMessageContent: (conversationId, messageId, content) => {
    set((s) => ({
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? {
              ...c,
              messages: c.messages.map((m) =>
                m.id === messageId ? { ...m, content } : m,
              ),
            }
          : c,
      ),
    }));
    // Persist updated content to IndexedDB (debounced naturally by streaming cadence)
    messageRepo.update(messageId, { content }).catch(console.error);
  },

  getActiveConversation: () => {
    const state = get();
    return state.conversations.find((c) => c.id === state.activeConversationId);
  },

  hydrateConversations: async () => {
    const convRows = await conversationRepo.getAll();
    const conversations: Conversation[] = await Promise.all(
      convRows.map(async (conv) => {
        const messages = await messageRepo.getByConversation(conv.id);
        return { ...conv, messages };
      }),
    );
    const lastId = localStorage.getItem('swarm-last-conversation');
    const activeId = conversations.find((c) => c.id === lastId) ? lastId : (conversations[0]?.id ?? null);
    set({ conversations, activeConversationId: activeId });
  },
});
