import type { AgentType } from './agent';

export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';
export type TaskPriority = 'low' | 'medium' | 'high';

/**
 * Task — a manual user-created todo associated with a session/thread.
 * Never implies model execution; purely user-managed.
 */
export interface Task {
  id: string;
  sessionId: string;
  conversationId: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignedAgent?: AgentType;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}
