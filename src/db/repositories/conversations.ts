import { db, type DBConversation } from '../schema';
import type { Conversation } from '@/types/conversation';

function toDBConversation(conv: Conversation): DBConversation {
  return {
    id: conv.id,
    title: conv.title,
    activeAgent: conv.activeAgent,
    createdAt: conv.createdAt,
    updatedAt: conv.updatedAt,
  };
}

function fromDBConversation(row: DBConversation): Omit<Conversation, 'messages'> {
  return {
    id: row.id,
    title: row.title,
    activeAgent: row.activeAgent as Conversation['activeAgent'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const conversationRepo = {
  async getAll(): Promise<Omit<Conversation, 'messages'>[]> {
    const rows = await db.conversations.orderBy('updatedAt').reverse().toArray();
    return rows.map(fromDBConversation);
  },

  async getById(id: string): Promise<Omit<Conversation, 'messages'> | undefined> {
    const row = await db.conversations.get(id);
    return row ? fromDBConversation(row) : undefined;
  },

  async create(conv: Conversation): Promise<void> {
    await db.conversations.add(toDBConversation(conv));
  },

  async update(id: string, changes: Partial<Pick<Conversation, 'title' | 'activeAgent' | 'updatedAt'>>): Promise<void> {
    await db.conversations.update(id, changes);
  },

  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.conversations, db.messages, db.artifacts], async () => {
      await db.messages.where('conversationId').equals(id).delete();
      await db.artifacts.where('conversationId').equals(id).delete();
      await db.conversations.delete(id);
    });
  },
};
