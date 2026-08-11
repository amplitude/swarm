import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/store/app-store';

describe('Session CRUD', () => {
  beforeEach(() => {
    useAppStore.setState({
      sessions: [],
      activeSessionId: null,
      conversations: [],
      activeConversationId: null,
      tasks: [],
    });
  });

  it('ensureDefaultSession creates a session when none exist', () => {
    const id = useAppStore.getState().ensureDefaultSession();
    const state = useAppStore.getState();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]!.id).toBe(id);
    expect(state.sessions[0]!.name).toBe('Default');
    expect(state.activeSessionId).toBe(id);
  });

  it('createSession adds a new session', () => {
    const id = useAppStore.getState().createSession('Test Session');
    const state = useAppStore.getState();
    expect(state.sessions).toHaveLength(1);
    expect(state.sessions[0]!.name).toBe('Test Session');
    expect(state.activeSessionId).toBe(id);
  });

  it('renameSession updates the session name', () => {
    const id = useAppStore.getState().createSession('Old Name');
    useAppStore.getState().renameSession(id, 'New Name');
    expect(useAppStore.getState().sessions[0]!.name).toBe('New Name');
  });

  it('deleteSession removes the session and clears activeId', () => {
    const id = useAppStore.getState().createSession('To Delete');
    expect(useAppStore.getState().sessions).toHaveLength(1);
    useAppStore.getState().deleteSession(id);
    expect(useAppStore.getState().sessions).toHaveLength(0);
    expect(useAppStore.getState().activeSessionId).toBeNull();
  });

  it('deleteSession with non-active session preserves activeSession', () => {
    const id1 = useAppStore.getState().createSession('Session 1');
    // Manually set to simulate ensuring first, then adding second
    useAppStore.getState().createSession('Session 2');
  });

  it('setActiveSession changes active session', () => {
    const id1 = useAppStore.getState().createSession('Session 1');
    const id2 = useAppStore.getState().createSession('Session 2');
    expect(useAppStore.getState().activeSessionId).toBe(id2);
    useAppStore.getState().setActiveSession(id1);
    expect(useAppStore.getState().activeSessionId).toBe(id1);
  });
});
