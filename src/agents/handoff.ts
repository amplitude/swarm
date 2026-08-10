import { nanoid } from 'nanoid';
import type { AgentType, HandoffProposal, HandoffRequest } from '@/types/agent';
import type { Message } from '@/types/message';
import type { Artifact } from '@/types/tool';
import { agentDefinitions } from './definitions';

/**
 * Validates that a handoff is allowed based on the source agent's canHandoffTo list.
 */
export function validateHandoff(from: AgentType, to: AgentType): boolean {
  const fromAgent = agentDefinitions[from];
  return fromAgent.canHandoffTo.includes(to);
}

/**
 * Creates a HandoffProposal from a tool call's parameters.
 * The proposal starts in 'pending' status -- the user must approve it
 * before the agent switch happens.
 */
export function createHandoffProposal(
  fromAgent: AgentType,
  params: Record<string, unknown>,
): HandoffProposal | null {
  const toAgent = params['target_agent'] as AgentType | undefined;
  if (!toAgent || !isValidAgentType(toAgent)) {
    return null;
  }

  if (!validateHandoff(fromAgent, toAgent)) {
    return null;
  }

  return {
    id: nanoid(),
    fromAgent,
    toAgent,
    reason: (params['reason'] as string) ?? '',
    context: (params['context'] as string) ?? '',
    status: 'pending',
  };
}

/**
 * Builds the system-level context message injected into the conversation
 * when a handoff is approved. The receiving agent sees the full conversation
 * history PLUS this summary message at the handoff boundary.
 */
export function buildHandoffContextMessage(
  proposal: HandoffProposal | HandoffRequest,
  artifacts?: Artifact[],
): string {
  const fromName = agentDefinitions[proposal.fromAgent].name;
  const toName = agentDefinitions[proposal.toAgent].name;
  let msg = `[Handoff from ${fromName} to ${toName}]`;
  if (proposal.reason) {
    msg += `\nReason: ${proposal.reason}`;
  }
  if (proposal.context) {
    msg += `\nContext summary: ${proposal.context}`;
  }
  if (artifacts && artifacts.length > 0) {
    msg += `\nAvailable artifacts from this conversation:`;
    for (const a of artifacts) {
      msg += `\n  - "${a.name}" (${a.type}, created by ${a.creatorAgent})`;
    }
  }
  return msg;
}

/**
 * Creates the messages to append to the conversation when a handoff
 * is approved by the user.
 */
export function buildHandoffMessages(
  proposal: HandoffProposal,
  conversationId: string,
  artifacts?: Artifact[],
): Message[] {
  const targetAgent = 'redirectedTo' in proposal && proposal.redirectedTo
    ? proposal.redirectedTo
    : proposal.toAgent;

  const contextMessage: Message = {
    id: nanoid(),
    conversationId,
    role: 'system',
    content: buildHandoffContextMessage({
      ...proposal,
      toAgent: targetAgent,
    }, artifacts),
    agentType: targetAgent,
    timestamp: Date.now(),
    metadata: {
      handoffId: proposal.id,
      handoffFrom: proposal.fromAgent,
      handoffTo: targetAgent,
    },
  };

  return [contextMessage];
}

const VALID_AGENT_TYPES = new Set<string>(['manager', 'coder', 'pm', 'designer', 'general']);

function isValidAgentType(value: string): value is AgentType {
  return VALID_AGENT_TYPES.has(value);
}
