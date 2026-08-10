import type { StateCreator } from 'zustand';
import type { Decision } from '../../types/decision';

export interface DecisionSlice {
  decisions: Decision[];
  addDecision: (decision: Decision) => void;
  resolveDecision: (id: string, optionId: string) => void;
  clearResolved: () => void;
  getPendingDecisions: () => Decision[];
}

export const createDecisionSlice: StateCreator<DecisionSlice, [], [], DecisionSlice> = (
  set,
  get,
) => ({
  decisions: [],

  addDecision: (decision) =>
    set((s) => ({
      decisions: [...s.decisions, decision],
    })),

  resolveDecision: (id, optionId) =>
    set((s) => ({
      decisions: s.decisions.map((d) =>
        d.id === id
          ? { ...d, status: optionId.includes('reject') ? 'rejected' : 'approved', resolvedAt: Date.now(), resolvedOptionId: optionId } as Decision
          : d,
      ),
    })),

  clearResolved: () =>
    set((s) => ({
      decisions: s.decisions.filter((d) => d.status === 'pending'),
    })),

  getPendingDecisions: () => get().decisions.filter((d) => d.status === 'pending'),
});
