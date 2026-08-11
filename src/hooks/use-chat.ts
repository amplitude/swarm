import { useCallback, useRef, useState } from 'react';
import { useAppStore } from '@/store/app-store';
import { Orchestrator } from '@/agents/orchestrator';
import { LLMChatAdapter } from '@/llm/llm-chat-adapter';
import { getSharedProvider } from '@/llm/provider-singleton';
import { RealToolExecutor } from '@/tools/executor';
import { nanoid } from 'nanoid';
import type { HandoffProposal } from '@/types/agent';
import type { Message } from '@/types/message';
import type { Decision } from '@/types/decision';
import { agentDefinitions, getDefaultEnabledTools } from '@/agents/definitions';

const toolExecutor = new RealToolExecutor();

export interface ChatError {
  type: 'error' | 'unavailable';
  message: string;
}

/**
 * Hook that wires up the full chat flow:
 *   user sends message → orchestrator.runTurn() → stream tokens → display response
 */
export function useChat() {
  const runningRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const lastMessageRef = useRef<string | null>(null);
  const [chatError, setChatError] = useState<ChatError | null>(null);

  const sendMessage = useCallback(async (text: string) => {
    if (runningRef.current) return;

    const store = useAppStore.getState();
    const { llmStatus } = store;

    if (llmStatus !== 'ready' && llmStatus !== 'generating') {
      if (llmStatus === 'error' || llmStatus === 'idle') {
        const errorMsg = llmStatus === 'error'
          ? 'Model failed to load. Please retry from the status bar.'
          : 'Model is not loaded. Please wait for the download to complete.';
        setChatError({ type: 'unavailable', message: errorMsg });
      }
      return;
    }

    setChatError(null);
    lastMessageRef.current = text;

    const activeAgent = store.activeAgent;

    // Ensure we have a conversation for this agent
    let convId = store.activeConversationId;
    if (!convId) {
      convId = store.createConversation(text.slice(0, 40), activeAgent);
    }

    // Add user message
    const userMsg: Message = {
      id: nanoid(),
      conversationId: convId,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    store.pushMessage(convId, userMsg);

    // Create a placeholder assistant message for streaming
    const assistantMsgId = nanoid();
    const assistantMsg: Message = {
      id: assistantMsgId,
      conversationId: convId,
      role: 'assistant',
      content: '',
      agentType: activeAgent,
      timestamp: Date.now(),
    };
    store.pushMessage(convId, assistantMsg);

    // Set agent thinking
    store.setAgentThinking(activeAgent, true);
    runningRef.current = true;

    // Create abort controller for this generation
    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      // Ensure the shared provider is loaded
      const provider = getSharedProvider();
      if (!provider.isLoaded()) {
        const modelName = store.llmModelName;
        if (modelName) {
          await provider.load(modelName);
        } else {
          throw new Error('No model loaded');
        }
      }

      // Create the adapter with token streaming
      let streamedContent = '';
      const adapter = new LLMChatAdapter(provider, (token) => {
        if (abortController.signal.aborted) return;
        streamedContent += token;
        useAppStore.getState().updateMessageContent(convId!, assistantMsgId, streamedContent);
      });

      const orchestrator = new Orchestrator(adapter, toolExecutor, {
        onIteration: (iter, max) => {
          console.log(`[orchestrator] iteration ${iter}/${max}`);
        },
        onToolCallStart: (tc) => {
          console.log(`[orchestrator] tool call start: ${tc.toolId}`);
        },
        onToolCallEnd: (tc, result) => {
          console.log(`[orchestrator] tool call end: ${tc.toolId}`, result);
        },
        onHandoffProposed: (proposal) => {
          console.log(`[orchestrator] handoff proposed: ${proposal.fromAgent} -> ${proposal.toAgent}`);
        },
        onToken: (_token) => {
          // Already handled by the adapter
        },
      });

      // Get conversation messages (excluding the placeholder)
      const conv = useAppStore.getState().conversations.find((c) => c.id === convId);
      const messages = conv?.messages.filter((m) => m.id !== assistantMsgId) ?? [];

      const enabledToolIds = getDefaultEnabledTools(activeAgent);
      const turn = await orchestrator.runTurn(messages, activeAgent, enabledToolIds);

      // Check if aborted during runTurn
      if (abortController.signal.aborted) {
        const currentContent = useAppStore.getState().conversations
          .find((c) => c.id === convId)
          ?.messages.find((m) => m.id === assistantMsgId)?.content;
        useAppStore.getState().updateMessageContent(
          convId,
          assistantMsgId,
          (currentContent || streamedContent) + '\n\n*Generation stopped*',
        );
        return;
      }

      // Update the placeholder with the final response
      if (turn.finalResponse) {
        useAppStore.getState().updateMessageContent(convId, assistantMsgId, turn.finalResponse);
      } else if (!streamedContent) {
        useAppStore.getState().updateMessageContent(
          convId,
          assistantMsgId,
          '[No response from agent]',
        );
      }

      // Add any tool call/result messages that the orchestrator produced
      const extraMessages = turn.messages.filter(
        (m) => m.role === 'tool' || (m.role === 'assistant' && m.toolCall),
      );
      if (extraMessages.length > 0) {
        useAppStore.getState().pushMessages(convId, extraMessages);
      }

      // Handle pending handoff
      if (turn.pendingHandoff) {
        handleHandoffProposal(convId, turn.pendingHandoff, assistantMsgId);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error('[useChat] error:', errorMessage);
      setChatError({ type: 'error', message: errorMessage });

      // Update the placeholder with the error
      const currentState = useAppStore.getState();
      const currentContent = currentState.conversations
        .find((c) => c.id === convId)
        ?.messages.find((m) => m.id === assistantMsgId)?.content;
      if (currentContent === '') {
        currentState.updateMessageContent(
          convId,
          assistantMsgId,
          `Error: ${errorMessage}`,
        );
      }
    } finally {
      const store = useAppStore.getState();
      store.setAgentThinking(activeAgent, false);
      runningRef.current = false;
      abortRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const retry = useCallback(() => {
    const lastText = lastMessageRef.current;
    if (lastText) {
      // Find and remove the last assistant placeholder message
      const store = useAppStore.getState();
      const convId = store.activeConversationId;
      if (convId) {
        const conv = store.conversations.find((c) => c.id === convId);
        if (conv) {
          const lastAssistantIdx = [...conv.messages].reverse().findIndex(
            (m) => m.role === 'assistant' && !m.toolCall,
          );
          if (lastAssistantIdx >= 0) {
            const msgToRemove = conv.messages[conv.messages.length - 1 - lastAssistantIdx];
            if (msgToRemove) {
              // Remove the assistant message and re-send
              store.conversations = store.conversations.map((c) =>
                c.id === convId
                  ? { ...c, messages: c.messages.filter((m) => m.id !== msgToRemove.id) }
                  : c,
              );
            }
          }
        }
      }
      setChatError(null);
      sendMessage(lastText);
    }
  }, [sendMessage]);

  return { sendMessage, stop, retry, chatError, clearError: () => setChatError(null), isRunning: runningRef.current };
}

function handleHandoffProposal(
  convId: string,
  proposal: HandoffProposal,
  assistantMsgId: string,
) {
  const store = useAppStore.getState();
  // Update the assistant message to show the handoff proposal
  const proposalText = `I'd like to hand this off to **${proposal.toAgent}** because: ${proposal.reason}${proposal.context ? `\n\nContext: ${proposal.context}` : ''}`;
  store.updateMessageContent(convId, assistantMsgId, proposalText);

  // Add a handoff proposal message with metadata for the HandoffApproval component
  const handoffMsg: Message = {
    id: nanoid(),
    conversationId: convId,
    role: 'assistant',
    content: '',
    agentType: proposal.fromAgent,
    timestamp: Date.now(),
    metadata: {
      isHandoffProposal: true,
      handoffProposalId: proposal.id,
      handoffProposalData: proposal,
    },
  };
  store.pushMessage(convId, handoffMsg);

  // Push a Decision to the central decision queue
  const fromName = agentDefinitions[proposal.fromAgent].name;
  const toName = agentDefinitions[proposal.toAgent].name;
  const decision: Decision = {
    id: proposal.id,
    type: 'handoff',
    agentType: proposal.fromAgent,
    title: `Hand off to ${toName}`,
    description: proposal.reason,
    status: 'pending',
    createdAt: Date.now(),
    options: [
      { id: 'approve-once', label: 'Approve once', variant: 'primary', tier: 'once' },
      { id: 'approve-route', label: `Always ${fromName} \u2192 ${toName}`, variant: 'primary', tier: 'route' },
      { id: 'approve-all', label: 'Approve all', variant: 'neutral', tier: 'all' },
      { id: 'reject', label: 'Reject', variant: 'danger' },
    ],
    metadata: {
      handoffProposal: proposal,
      conversationId: convId,
    },
  };
  store.addDecision(decision);
}
