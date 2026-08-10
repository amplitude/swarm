import { db, type DBArtifact } from '../schema';
import type { Artifact } from '@/types/tool';

function toDBRow(a: Artifact): DBArtifact {
  return {
    id: a.id,
    conversationId: a.conversationId,
    type: a.type,
    name: a.name,
    content: a.content,
    language: a.language,
    creatorAgent: a.creatorAgent,
    sharedWith: a.sharedWith ? JSON.stringify(a.sharedWith) : undefined,
    handoffId: a.handoffId,
    createdAt: a.createdAt,
    updatedAt: a.updatedAt,
  };
}

function fromDBRow(row: DBArtifact): Artifact {
  return {
    id: row.id,
    conversationId: row.conversationId,
    type: row.type as Artifact['type'],
    name: row.name,
    content: row.content,
    language: row.language,
    creatorAgent: (row.creatorAgent || 'general') as Artifact['creatorAgent'],
    sharedWith: row.sharedWith ? JSON.parse(row.sharedWith) : undefined,
    handoffId: row.handoffId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const artifactRepo = {
  async getAll(): Promise<Artifact[]> {
    const rows = await db.artifacts.orderBy('createdAt').reverse().toArray();
    return rows.map(fromDBRow);
  },

  async getByAgent(creatorAgent: string): Promise<Artifact[]> {
    const rows = await db.artifacts
      .where('creatorAgent')
      .equals(creatorAgent)
      .sortBy('createdAt');
    return rows.map(fromDBRow);
  },

  async getByConversation(conversationId: string): Promise<Artifact[]> {
    const rows = await db.artifacts
      .where('conversationId')
      .equals(conversationId)
      .sortBy('createdAt');
    return rows.map(fromDBRow);
  },

  async getById(id: string): Promise<Artifact | undefined> {
    const row = await db.artifacts.get(id);
    return row ? fromDBRow(row) : undefined;
  },

  async add(artifact: Artifact): Promise<void> {
    await db.artifacts.add(toDBRow(artifact));
  },

  async update(id: string, changes: Partial<Pick<Artifact, 'content' | 'name' | 'updatedAt'>>): Promise<void> {
    await db.artifacts.update(id, changes);
  },

  async remove(id: string): Promise<void> {
    await db.artifacts.delete(id);
  },

  async removeByConversation(conversationId: string): Promise<void> {
    await db.artifacts.where('conversationId').equals(conversationId).delete();
  },
};
