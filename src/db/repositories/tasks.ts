import { db, type DBTask } from '../schema';
import type { Task } from '@/types/task';

function toDBTask(task: Task): DBTask {
  return {
    id: task.id,
    sessionId: task.sessionId,
    conversationId: task.conversationId,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    assignedAgent: task.assignedAgent,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt,
    completedAt: task.completedAt,
  };
}

function fromDBTask(row: DBTask): Task {
  return {
    id: row.id,
    sessionId: row.sessionId,
    conversationId: row.conversationId,
    title: row.title,
    description: row.description,
    status: row.status as Task['status'],
    priority: row.priority as Task['priority'],
    assignedAgent: row.assignedAgent as Task['assignedAgent'],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    completedAt: row.completedAt,
  };
}

export const taskRepo = {
  async getByConversation(conversationId: string): Promise<Task[]> {
    const rows = await db.tasks
      .where('conversationId')
      .equals(conversationId)
      .sortBy('createdAt');
    return rows.map(fromDBTask);
  },

  async getBySession(sessionId: string): Promise<Task[]> {
    const rows = await db.tasks
      .where('sessionId')
      .equals(sessionId)
      .sortBy('createdAt');
    return rows.map(fromDBTask);
  },

  async getById(id: string): Promise<Task | undefined> {
    const row = await db.tasks.get(id);
    return row ? fromDBTask(row) : undefined;
  },

  async create(task: Task): Promise<void> {
    await db.tasks.add(toDBTask(task));
  },

  async update(id: string, changes: Partial<Pick<Task, 'title' | 'description' | 'status' | 'priority' | 'assignedAgent' | 'updatedAt' | 'completedAt'>>): Promise<void> {
    await db.tasks.update(id, changes);
  },

  async remove(id: string): Promise<void> {
    await db.tasks.delete(id);
  },
};
