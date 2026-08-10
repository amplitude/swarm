import { db, type DBMessage } from '../schema';
import type { Message } from '@/types/message';

function toDBMessage(msg: Message): DBMessage {
  return {
    id: msg.id,
    conversationId: msg.conversationId,
    role: msg.role,
    content: msg.content,
    agentType: msg.agentType,
    toolCall: msg.toolCall ? JSON.stringify(msg.toolCall) : undefined,
    toolResult: msg.toolResult ? JSON.stringify(msg.toolResult) : undefined,
    artifacts: msg.artifacts ? JSON.stringify(msg.artifacts) : undefined,
    timestamp: msg.timestamp,
    metadata: msg.metadata ? JSON.stringify(msg.metadata) : undefined,
  };
}

function fromDBMessage(row: DBMessage): Message {
  return {
    id: row.id,
    conversationId: row.conversationId,
    role: row.role as Message['role'],
    content: row.content,
    agentType: row.agentType as Message['agentType'],
    toolCall: row.toolCall ? JSON.parse(row.toolCall) : undefined,
    toolResult: row.toolResult ? JSON.parse(row.toolResult) : undefined,
    artifacts: row.artifacts ? JSON.parse(row.artifacts) : undefined,
    timestamp: row.timestamp,
    metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
  };
}

export const messageRepo = {
  async getByConversation(conversationId: string): Promise<Message[]> {
    const rows = await db.messages
      .where('conversationId')
      .equals(conversationId)
      .sortBy('timestamp');
    return rows.map(fromDBMessage);
  },

  async add(msg: Message): Promise<void> {
    await db.messages.add(toDBMessage(msg));
  },

  async bulkAdd(msgs: Message[]): Promise<void> {
    await db.messages.bulkAdd(msgs.map(toDBMessage));
  },

  async update(id: string, changes: Partial<Pick<DBMessage, 'content' | 'metadata'>>): Promise<void> {
    await db.messages.update(id, changes);
  },

  async remove(id: string): Promise<void> {
    await db.messages.delete(id);
  },

  async removeByConversation(conversationId: string): Promise<void> {
    await db.messages.where('conversationId').equals(conversationId).delete();
  },
};
