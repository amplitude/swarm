import { db, type DBSession } from '../schema';
import type { Session } from '@/types/session';

function toDBSession(session: Session): DBSession {
  return {
    id: session.id,
    name: session.name,
    sortOrder: session.sortOrder,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    schemaVersion: session.schemaVersion,
  };
}

function fromDBSession(row: DBSession): Session {
  return {
    id: row.id,
    name: row.name,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    schemaVersion: row.schemaVersion,
  };
}

export const sessionRepo = {
  async getAll(): Promise<Session[]> {
    const rows = await db.sessions.orderBy('sortOrder').toArray();
    return rows.map(fromDBSession);
  },

  async getById(id: string): Promise<Session | undefined> {
    const row = await db.sessions.get(id);
    return row ? fromDBSession(row) : undefined;
  },

  async create(session: Session): Promise<void> {
    await db.sessions.add(toDBSession(session));
  },

  async update(id: string, changes: Partial<Pick<Session, 'name' | 'sortOrder' | 'updatedAt'>>): Promise<void> {
    await db.sessions.update(id, changes);
  },

  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.sessions, db.conversations, db.messages, db.tasks, db.artifacts], async () => {
      // Remove associated conversations, messages, artifacts
      const sessionConversations = await db.conversations.where('sessionId').equals(id).toArray();
      for (const conv of sessionConversations) {
        await db.messages.where('conversationId').equals(conv.id).delete();
        await db.artifacts.where('conversationId').equals(conv.id).delete();
      }
      await db.conversations.where('sessionId').equals(id).delete();
      await db.tasks.where('sessionId').equals(id).delete();
      await db.sessions.delete(id);
    });
  },
};
