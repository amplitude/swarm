import type { StateCreator } from 'zustand';
import type { Session } from '../../types/session';
import { nanoid } from 'nanoid';
import { sessionRepo } from '../../db/repositories/sessions';

export interface SessionSlice {
  sessions: Session[];
  activeSessionId: string | null;

  createSession: (name?: string) => string;
  setActiveSession: (id: string | null) => void;
  renameSession: (id: string, name: string) => void;
  deleteSession: (id: string) => void;
  hydrateSessions: () => Promise<void>;
  ensureDefaultSession: () => string;
}

export const createSessionSlice: StateCreator<SessionSlice, [], [], SessionSlice> = (set, get) => ({
  sessions: [],
  activeSessionId: null,

  createSession: (name) => {
    const id = nanoid();
    const now = Date.now();
    const session: Session = {
      id,
      name: name || 'New Session',
      sortOrder: get().sessions.length,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };
    set((s) => ({
      sessions: [...s.sessions, session],
      activeSessionId: id,
    }));
    sessionRepo.create(session).catch(console.error);
    return id;
  },

  setActiveSession: (id) => {
    set({ activeSessionId: id });
  },

  renameSession: (id, name) => {
    set((s) => ({
      sessions: s.sessions.map((sess) =>
        sess.id === id ? { ...sess, name, updatedAt: Date.now() } : sess,
      ),
    }));
    sessionRepo.update(id, { name, updatedAt: Date.now() }).catch(console.error);
  },

  deleteSession: (id) => {
    // If deleting the active session, select the next one
    const remaining = get().sessions.filter((sess) => sess.id !== id);
    const wasActive = get().activeSessionId === id;
    const nextActiveId = wasActive ? (remaining[0]?.id ?? null) : get().activeSessionId;

    set({
      sessions: remaining,
      activeSessionId: nextActiveId,
    });

    sessionRepo.remove(id).catch(console.error);
  },

  hydrateSessions: async () => {
    const sessions = await sessionRepo.getAll();
    set({ sessions, activeSessionId: sessions[0]?.id ?? null });
  },

  ensureDefaultSession: () => {
    const state = get();
    if (state.sessions.length > 0) {
      const id = state.sessions[0]!.id;
      if (!state.activeSessionId) {
        set({ activeSessionId: id });
      }
      return state.activeSessionId || id;
    }
    // Create one empty session
    const id = nanoid();
    const now = Date.now();
    const session: Session = {
      id,
      name: 'Default',
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
      schemaVersion: 1,
    };
    set({ sessions: [session], activeSessionId: id });
    sessionRepo.create(session).catch(console.error);
    return id;
  },
});
