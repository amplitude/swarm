import { useCallback, useRef } from 'react';
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

/**
 * Hook that wires up the full chat flow:
 *   user sends message -> orchestrator.runTurn() -> stream tokens -> display response
 */
export function useChat() {
  const runningRef = useRef(false);

  const sendMessage = useCallback(async (text: string) => {
    if (runningRef.current) return;

    const store = useAppStore.getState();
    const { llmStatus } = store;

    if (llmStatus !== 'ready' && llmStatus !== 'generating') {
      console.warn('LLM not ready, status:', llmStatus);
      return;
    }

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

      // Update the placeholder with the final response
      if (turn.finalResponse) {
        useAppStore.getState().updateMessageContent(convId, assistantMsgId, turn.finalResponse);
      } else if (streamedContent) {
        // Content was already streamed via onToken
      } else {
        // Remove empty placeholder if no response
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
      console.error('[useChat] error:', err);
      useAppStore.getState().updateMessageContent(
        convId,
        assistantMsgId,
        `Error: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      store.setAgentThinking(activeAgent, false);
      runningRef.current = false;
    }
  }, []);

  return { sendMessage, isRunning: runningRef.current };
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
