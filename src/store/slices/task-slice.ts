import type { StateCreator } from 'zustand';
import type { Task, TaskStatus, TaskPriority } from '../../types/task';
import type { AgentType } from '../../types/agent';
import { nanoid } from 'nanoid';
import { taskRepo } from '../../db/repositories/tasks';

export interface TaskSlice {
  tasks: Task[];

  addTask: (sessionId: string, conversationId: string, title: string, description?: string, priority?: TaskPriority, assignedAgent?: AgentType) => void;
  updateTaskStatus: (id: string, status: TaskStatus) => void;
  updateTask: (id: string, changes: Partial<Pick<Task, 'title' | 'description' | 'priority' | 'assignedAgent'>>) => void;
  deleteTask: (id: string) => void;
  getTasksForConversation: (conversationId: string) => Task[];
  getTasksForSession: (sessionId: string) => Task[];
  hydrateTasks: () => Promise<void>;
}

export const createTaskSlice: StateCreator<TaskSlice, [], [], TaskSlice> = (set, get) => ({
  tasks: [],

  addTask: (sessionId, conversationId, title, description, priority, assignedAgent) => {
    const now = Date.now();
    const task: Task = {
      id: nanoid(),
      sessionId,
      conversationId,
      title,
      description: description || '',
      status: 'pending',
      priority: priority || 'medium',
      assignedAgent,
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({
      tasks: [...s.tasks, task],
    }));
    taskRepo.create(task).catch(console.error);
  },

  updateTaskStatus: (id, status) => {
    const now = Date.now();
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id
          ? { ...t, status, updatedAt: now, ...(status === 'completed' ? { completedAt: now } : {}) }
          : t,
      ),
    }));
    taskRepo.update(id, { status, updatedAt: now, ...(status === 'completed' ? { completedAt: now } : {}) }).catch(console.error);
  },

  updateTask: (id, changes) => {
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? { ...t, ...changes, updatedAt: Date.now() } : t,
      ),
    }));
    taskRepo.update(id, { ...changes, updatedAt: Date.now() }).catch(console.error);
  },

  deleteTask: (id) => {
    set((s) => ({
      tasks: s.tasks.filter((t) => t.id !== id),
    }));
    taskRepo.remove(id).catch(console.error);
  },

  getTasksForConversation: (conversationId) => {
    return get().tasks.filter((t) => t.conversationId === conversationId);
  },

  getTasksForSession: (sessionId) => {
    return get().tasks.filter((t) => t.sessionId === sessionId);
  },

  hydrateTasks: async () => {
    const allTasks: Task[] = [];
    const sessions = await (await import('../../db/repositories/sessions')).sessionRepo.getAll();
    for (const session of sessions) {
      const sessionTasks = await taskRepo.getBySession(session.id);
      allTasks.push(...sessionTasks);
    }
    set({ tasks: allTasks });
  },
});
