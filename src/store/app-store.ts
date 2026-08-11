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
 * Persists the agent change to the conversation record in IndexedDB.
 */
export function switchAgent(agent: AppStore['activeAgent']): void {
  const state = useAppStore.getState();
  state.setActiveAgent(agent);

  // Persist agent change to current conversation (if one is active)
  const convId = state.activeConversationId;
  if (convId) {
    state.updateConversationAgent(convId, agent);
  }

  const agentConv = state.conversations
    .filter((c) => c.activeAgent === agent)
    .sort((a, b) => b.updatedAt - a.updatedAt)[0];

  state.setActiveConversation(agentConv?.id ?? null);
}

/**
 * Switch the active session AND find the most recent conversation
 * for the current active agent within that session.
 */
export function switchSession(sessionId: string): void {
  const state = useAppStore.getState();
  state.setActiveSession(sessionId);

  // Find conversations for this session and current agent
  const sessionConvs = state.getConversationsBySession(sessionId)
    .filter((c) => c.activeAgent === state.activeAgent)
    .sort((a, b) => b.updatedAt - a.updatedAt);

  state.setActiveConversation(sessionConvs[0]?.id ?? null);
}

export async function initializeStore(): Promise<void> {
  await requestPersistentStorage();

  await useAppStore.getState().hydrateSessions();
  await useAppStore.getState().hydrateConversations();
  await useAppStore.getState().hydrateTasks();

  // Ensure at least one session exists
  useAppStore.getState().ensureDefaultSession();

  // Restore active agent: prefer the active conversation's stored agent,
  // then localStorage fallback, then default.
  const state = useAppStore.getState();
  const activeConv = state.conversations.find((c) => c.id === state.activeConversationId);
  if (activeConv) {
    // Conversation's activeAgent is the authoritative source after reload
    const targetAgent = activeConv.activeAgent;
    if (['manager', 'coder', 'pm', 'designer', 'general'].includes(targetAgent)) {
      state.setActiveAgent(targetAgent as AppStore['activeAgent']);
    }
  } else {
    const lastAgent = localStorage.getItem('swarm-last-agent');
    if (lastAgent && ['manager', 'coder', 'pm', 'designer', 'general'].includes(lastAgent)) {
      state.setActiveAgent(lastAgent as AppStore['activeAgent']);
    }
  }

  // Ensure at least one conversation exists for the active session
  if (!useAppStore.getState().activeConversationId) {
    const s = useAppStore.getState();
    const sessionId = s.activeSessionId || 'default';
    s.createConversation(undefined, s.activeAgent, sessionId);
  }
}
