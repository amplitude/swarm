import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/store/app-store';

describe('Task CRUD', () => {
  beforeEach(() => {
    useAppStore.setState({
      tasks: [],
    });
  });

  it('addTask creates a new task with pending status', () => {
    useAppStore.getState().addTask('session-1', 'conv-1', 'Test task', 'A description', 'high', 'coder');
    const tasks = useAppStore.getState().tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]!.title).toBe('Test task');
    expect(tasks[0]!.description).toBe('A description');
    expect(tasks[0]!.status).toBe('pending');
    expect(tasks[0]!.priority).toBe('high');
    expect(tasks[0]!.assignedAgent).toBe('coder');
    expect(tasks[0]!.sessionId).toBe('session-1');
    expect(tasks[0]!.conversationId).toBe('conv-1');
  });

  it('addTask defaults priority to medium when not specified', () => {
    useAppStore.getState().addTask('session-1', 'conv-1', 'Default task');
    expect(useAppStore.getState().tasks[0]!.priority).toBe('medium');
  });

  it('updateTaskStatus changes status', () => {
    useAppStore.getState().addTask('session-1', 'conv-1', 'Task to complete');
    const id = useAppStore.getState().tasks[0]!.id;
    useAppStore.getState().updateTaskStatus(id, 'completed');
    expect(useAppStore.getState().tasks[0]!.status).toBe('completed');
    expect(useAppStore.getState().tasks[0]!.completedAt).toBeDefined();
  });

  it('updateTask changes title and description', () => {
    useAppStore.getState().addTask('session-1', 'conv-1', 'Old title');
    const id = useAppStore.getState().tasks[0]!.id;
    useAppStore.getState().updateTask(id, { title: 'New title', description: 'New description' });
    expect(useAppStore.getState().tasks[0]!.title).toBe('New title');
    expect(useAppStore.getState().tasks[0]!.description).toBe('New description');
  });

  it('deleteTask removes the task', () => {
    useAppStore.getState().addTask('session-1', 'conv-1', 'To delete');
    const id = useAppStore.getState().tasks[0]!.id;
    useAppStore.getState().deleteTask(id);
    expect(useAppStore.getState().tasks).toHaveLength(0);
  });

  it('getTasksForConversation returns tasks for the given conversation', () => {
    useAppStore.getState().addTask('session-1', 'conv-1', 'Conv 1 task');
    useAppStore.getState().addTask('session-1', 'conv-2', 'Conv 2 task');
    const conv1Tasks = useAppStore.getState().getTasksForConversation('conv-1');
    expect(conv1Tasks).toHaveLength(1);
    expect(conv1Tasks[0]!.title).toBe('Conv 1 task');
  });

  it('getTasksForSession returns tasks for the given session', () => {
    useAppStore.getState().addTask('session-1', 'conv-1', 'Session 1 task');
    useAppStore.getState().addTask('session-2', 'conv-2', 'Session 2 task');
    const session1Tasks = useAppStore.getState().getTasksForSession('session-1');
    expect(session1Tasks).toHaveLength(1);
    expect(session1Tasks[0]!.title).toBe('Session 1 task');
  });
});
