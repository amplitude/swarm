import type { StateCreator } from 'zustand';
import type { AgentType, AgentRuntimeState } from '../../types/agent';

export interface HandoffRoute {
  from: AgentType;
  to: AgentType;
}

export interface HandoffApprovalRules {
  autoApproveAll: boolean;
  approvedRoutes: HandoffRoute[];
}

const HANDOFF_RULES_KEY = 'swarm-handoff-rules';

function loadHandoffRules(): HandoffApprovalRules {
  try {
    const stored = localStorage.getItem(HANDOFF_RULES_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return { autoApproveAll: false, approvedRoutes: [] };
}

function saveHandoffRules(rules: HandoffApprovalRules): void {
  localStorage.setItem(HANDOFF_RULES_KEY, JSON.stringify(rules));
}

export interface AgentSlice {
  activeAgent: AgentType;
  agentState: Record<AgentType, AgentRuntimeState>;
  handoffRules: HandoffApprovalRules;

  setActiveAgent: (agent: AgentType) => void;
  setAgentThinking: (agent: AgentType, thinking: boolean) => void;
  setAutoApproveAll: (enabled: boolean) => void;
  approveRoute: (from: AgentType, to: AgentType) => void;
  removeApprovedRoute: (from: AgentType, to: AgentType) => void;
  resetHandoffRules: () => void;
  isRouteApproved: (from: AgentType, to: AgentType) => boolean;
}

const defaultRuntimeState = (): AgentRuntimeState => ({
  isThinking: false,
  currentIteration: 0,
  pendingToolCalls: [],
});

export const createAgentSlice: StateCreator<AgentSlice, [], [], AgentSlice> = (set, get) => ({
  activeAgent: 'manager',
  agentState: {
    manager: defaultRuntimeState(),
    coder: defaultRuntimeState(),
    pm: defaultRuntimeState(),
    designer: defaultRuntimeState(),
    general: defaultRuntimeState(),
  },
  handoffRules: loadHandoffRules(),

  setActiveAgent: (agent) => {
    localStorage.setItem('swarm-last-agent', agent);
    set({ activeAgent: agent });
  },
  setAgentThinking: (agent, thinking) =>
    set((s) => ({
      agentState: {
        ...s.agentState,
        [agent]: { ...s.agentState[agent], isThinking: thinking },
      },
    })),

  setAutoApproveAll: (enabled) => {
    set((s) => {
      const rules = { ...s.handoffRules, autoApproveAll: enabled };
      saveHandoffRules(rules);
      return { handoffRules: rules };
    });
  },

  approveRoute: (from, to) => {
    set((s) => {
      const already = s.handoffRules.approvedRoutes.some(
        (r) => r.from === from && r.to === to,
      );
      if (already) return s;
      const rules = {
        ...s.handoffRules,
        approvedRoutes: [...s.handoffRules.approvedRoutes, { from, to }],
      };
      saveHandoffRules(rules);
      return { handoffRules: rules };
    });
  },

  removeApprovedRoute: (from, to) => {
    set((s) => {
      const rules = {
        ...s.handoffRules,
        approvedRoutes: s.handoffRules.approvedRoutes.filter(
          (r) => !(r.from === from && r.to === to),
        ),
      };
      saveHandoffRules(rules);
      return { handoffRules: rules };
    });
  },

  resetHandoffRules: () => {
    const rules: HandoffApprovalRules = { autoApproveAll: false, approvedRoutes: [] };
    saveHandoffRules(rules);
    set({ handoffRules: rules });
  },

  isRouteApproved: (from, to) => {
    const { handoffRules } = get();
    if (handoffRules.autoApproveAll) return true;
    return handoffRules.approvedRoutes.some(
      (r) => r.from === from && r.to === to,
    );
  },
});
