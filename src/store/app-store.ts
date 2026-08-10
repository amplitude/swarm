import { create } from 'zustand';
import { createUISlice, type UISlice } from './slices/ui-slice';
import { createAgentSlice, type AgentSlice } from './slices/agent-slice';
import { createConversationSlice, type ConversationSlice } from './slices/conversation-slice';
import { createLLMSlice, type LLMSlice } from './slices/llm-slice';
import { createDecisionSlice, type DecisionSlice } from './slices/decision-slice';
import { requestPersistentStorage } from '../db/schema';

export type AppStore = UISlice & AgentSlice & ConversationSlice & LLMSlice & DecisionSlice;

export const useAppStore = create<AppStore>()((...a) => ({
  ...createUISlice(...a),
  ...createAgentSlice(...a),
  ...createConversationSlice(...a),
  ...createLLMSlice(...a),
  ...createDecisionSlice(...a),
}));

/**
 * Switch the active agent AND automatically switch to that agent's
 * most recent conversation (or null if none exists).
 */
export function switchAgent(agent: AppStore['activeAgent']): void {
  const state = useAppStore.getState();
  state.setActiveAgent(agent);

  // Find the most recent conversation for this agent
  const agentConv = state.conversations
    .filter((c) => c.activeAgent === agent)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];

  state.setActiveConversation(agentConv?.id ?? null);
}

export async function initializeStore(): Promise<void> {
  await requestPersistentStorage();

  await useAppStore.getState().hydrateConversations();

  const lastAgent = localStorage.getItem('swarm-last-agent');
  if (lastAgent && ['manager', 'coder', 'pm', 'designer', 'general'].includes(lastAgent)) {
    switchAgent(lastAgent as AppStore['activeAgent']);
  }
}
