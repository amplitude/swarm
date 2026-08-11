import { create } from 'zustand';
import { createUISlice, type UISlice } from './slices/ui-slice';
import { createAgentSlice, type AgentSlice } from './slices/agent-slice';
import { createConversationSlice, type ConversationSlice } from './slices/conversation-slice';
import { createLLMSlice, type LLMSlice } from './slices/llm-slice';
import { createDecisionSlice, type DecisionSlice } from './slices/decision-slice';
import { createSessionSlice, type SessionSlice } from './slices/session-slice';
import { createTaskSlice, type TaskSlice } from './slices/task-slice';
import { requestPersistentStorage } from '../db/schema';

export type AppStore = UISlice & AgentSlice & ConversationSlice & LLMSlice & DecisionSlice & SessionSlice & TaskSlice;

export const useAppStore = create<AppStore>()((...a) => ({
  ...createUISlice(...a),
  ...createAgentSlice(...a),
  ...createConversationSlice(...a),
  ...createLLMSlice(...a),
  ...createDecisionSlice(...a),
  ...createSessionSlice(...a),
  ...createTaskSlice(...a),
}));

/**
 * Switch the active agent AND automatically switch to that agent's
 * most recent conversation (or null if none exists).
 */
export function switchAgent(agent: AppStore['activeAgent']): void {
  const state = useAppStore.getState();
  state.setActiveAgent(agent);

  const agentConv = state.conversations
    .filter((c) => c.activeAgent === agent)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];

  state.setActiveConversation(agentConv?.id ?? null);
}

export async function initializeStore(): Promise<void> {
  await requestPersistentStorage();

  await useAppStore.getState().hydrateSessions();
  await useAppStore.getState().hydrateConversations();
  await useAppStore.getState().hydrateTasks();

  // Ensure at least one session exists
  useAppStore.getState().ensureDefaultSession();

  const lastAgent = localStorage.getItem('swarm-last-agent');
  if (lastAgent && ['manager', 'coder', 'pm', 'designer', 'general'].includes(lastAgent)) {
    switchAgent(lastAgent as AppStore['activeAgent']);
  }

  // Ensure at least one conversation exists if there isn't one
  if (!useAppStore.getState().activeConversationId) {
    const store = useAppStore.getState();
    store.createConversation(undefined, store.activeAgent);
  }
}
