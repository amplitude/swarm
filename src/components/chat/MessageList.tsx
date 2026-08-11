import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../../store/app-store';
import { MessageBubble } from './MessageBubble';
import { ThinkingIndicator } from './ThinkingIndicator';
import { HandoffApproval, type ApprovalTier } from './HandoffApproval';
import { InlineDecisionCard } from './InlineDecisionCard';
import type { AgentType, HandoffProposal } from '../../types/agent';

export function MessageList() {
  const conversation = useAppStore((s) =>
    s.conversations.find((c) => c.id === s.activeConversationId),
  );
  const activeAgent = useAppStore((s) => s.activeAgent);
  const isThinking = useAppStore((s) => s.agentState[s.activeAgent].isThinking);
  const setActiveAgent = useAppStore((s) => s.setActiveAgent);
  const addMessage = useAppStore((s) => s.addMessage);
  const isRouteApproved = useAppStore((s) => s.isRouteApproved);
  const approveRoute = useAppStore((s) => s.approveRoute);
  const setAutoApproveAll = useAppStore((s) => s.setAutoApproveAll);
  const resolveDecision = useAppStore((s) => s.resolveDecision);
  const decisions = useAppStore((s) => s.decisions);
  const bottomRef = useRef<HTMLDivElement>(null);

  const messages = conversation?.messages ?? [];
  const conversationId = conversation?.id ?? '';

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isThinking]);

  const executeHandoff = useCallback(
    (proposal: HandoffProposal) => {
      proposal.status = 'approved';
      resolveDecision(proposal.id, 'approve-once');
      setActiveAgent(proposal.toAgent);
      // Persist the agent change to the conversation record in IndexedDB
      const store = useAppStore.getState();
      store.updateConversationAgent(conversationId, proposal.toAgent);
      addMessage(conversationId, {
        conversationId,
        role: 'system',
        content: `[Handoff approved: switching to ${proposal.toAgent}. Context: ${proposal.context || proposal.reason}]`,
        agentType: proposal.toAgent,
        metadata: { handoffId: proposal.id, handoffApproved: true },
      });
    },
    [conversationId, setActiveAgent, addMessage, resolveDecision],
  );

  const handleApprove = useCallback(
    (proposal: HandoffProposal, tier: ApprovalTier) => {
      if (tier === 'route') {
        approveRoute(proposal.fromAgent, proposal.toAgent);
        resolveDecision(proposal.id, 'approve-route');
      } else if (tier === 'all') {
        setAutoApproveAll(true);
        resolveDecision(proposal.id, 'approve-all');
      }
      executeHandoff(proposal);
    },
    [executeHandoff, approveRoute, setAutoApproveAll, resolveDecision],
  );

  const handleReject = useCallback(
    (proposal: HandoffProposal) => {
      proposal.status = 'rejected';
      resolveDecision(proposal.id, 'reject');
      addMessage(conversationId, {
        conversationId,
        role: 'system',
        content: `[Handoff to ${proposal.toAgent} was rejected by the user. Continue handling the request yourself.]`,
        agentType: proposal.fromAgent,
        metadata: { handoffId: proposal.id, handoffRejected: true },
      });
    },
    [conversationId, addMessage, resolveDecision],
  );

  const handleRedirect = useCallback(
    (proposal: HandoffProposal, redirectTo: AgentType) => {
      proposal.status = 'redirected';
      proposal.redirectedTo = redirectTo;
      resolveDecision(proposal.id, 'approve-once');
      setActiveAgent(redirectTo);
      // Persist agent change to conversation record
      const store = useAppStore.getState();
      store.updateConversationAgent(conversationId, redirectTo);
      addMessage(conversationId, {
        conversationId,
        role: 'system',
        content: `[Handoff redirected: switching to ${redirectTo} instead of ${proposal.toAgent}. Context: ${proposal.context || proposal.reason}]`,
        agentType: redirectTo,
        metadata: { handoffId: proposal.id, handoffRedirected: true, redirectedTo: redirectTo },
      });
    },
    [conversationId, setActiveAgent, addMessage, resolveDecision],
  );

  const handleDecisionResolve = useCallback(
    (decisionId: string, optionId: string) => {
      resolveDecision(decisionId, optionId);
    },
    [resolveDecision],
  );

  // Auto-approve pending handoffs if route is pre-approved
  const autoApprovedIds = useRef(new Set<string>());
  useEffect(() => {
    for (const msg of messages) {
      if (
        msg.metadata?.isHandoffProposal &&
        msg.metadata.handoffProposalData
      ) {
        const proposal = msg.metadata.handoffProposalData as HandoffProposal;
        if (
          proposal.status === 'pending' &&
          !autoApprovedIds.current.has(proposal.id) &&
          isRouteApproved(proposal.fromAgent, proposal.toAgent)
        ) {
          autoApprovedIds.current.add(proposal.id);
          executeHandoff(proposal);
        }
      }
    }
  }, [messages, isRouteApproved, executeHandoff]);

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {messages.length === 0 && (
          <p className="py-12 text-center text-sm text-text-tertiary">
            Send a message to start the conversation.
          </p>
        )}
        {messages.map((msg) => {
          if (msg.metadata?.isHandoffProposal && msg.metadata.handoffProposalData) {
            const proposal = msg.metadata.handoffProposalData as HandoffProposal;
            const wasAutoApproved = autoApprovedIds.current.has(proposal.id);
            return (
              <HandoffApproval
                key={msg.id}
                proposal={proposal}
                onApprove={handleApprove}
                onReject={handleReject}
                onRedirect={handleRedirect}
                autoApproved={wasAutoApproved}
              />
            );
          }
          if (msg.metadata?.isDecision && msg.metadata.decisionId) {
            const decision = decisions.find(
              (d) => d.id === msg.metadata!.decisionId,
            );
            if (decision) {
              return (
                <InlineDecisionCard
                  key={msg.id}
                  decision={decision}
                  onResolve={handleDecisionResolve}
                />
              );
            }
          }
          return <MessageBubble key={msg.id} message={msg} />;
        })}
        {isThinking && <ThinkingIndicator agentType={activeAgent} />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
