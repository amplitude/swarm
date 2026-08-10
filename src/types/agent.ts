export type AgentType = 'manager' | 'coder' | 'pm' | 'designer' | 'general';

export interface AgentDefinition {
  id: AgentType;
  name: string;
  description: string;
  systemPrompt: string;
  skills: string[];
  /** All tools this agent CAN use (shown in settings panel). */
  tools: string[];
  /** Tools enabled by default. The user can toggle others on/off at runtime.
   *  If omitted, all tools in `tools` are enabled by default. */
  defaultEnabledTools?: string[];
  canHandoffTo: AgentType[];
  maxIterations: number;
  temperature: number;
}

export interface AgentRuntimeState {
  isThinking: boolean;
  currentIteration: number;
  pendingToolCalls: ToolCallRequest[];
}

/**
 * Result of a single agent turn. The turn ends when the agent either:
 * - Produces a final text response
 * - Proposes a handoff (which requires user approval before executing)
 * - Hits the max iteration limit
 */
export interface AgentTurn {
  agentId: AgentType;
  messages: Message[];
  toolCalls: ToolCallRequest[];
  /** Set when the agent proposes a handoff. The UI must render this
   *  as an approval widget. The handoff does NOT execute automatically. */
  pendingHandoff?: HandoffProposal;
  finalResponse?: string;
  iterations: number;
}

/**
 * A handoff proposed by an agent, awaiting user approval.
 * The UI renders this as an interactive element the user can approve/reject/redirect.
 */
export interface HandoffProposal {
  id: string;
  fromAgent: AgentType;
  toAgent: AgentType;
  reason: string;
  context: string;
  status: 'pending' | 'approved' | 'rejected' | 'redirected';
  /** If status is 'redirected', the user chose a different target agent */
  redirectedTo?: AgentType;
}

/** Legacy alias kept for internal handoff processing */
export type HandoffRequest = Pick<HandoffProposal, 'fromAgent' | 'toAgent' | 'reason' | 'context'>;

export interface RouterDecision {
  selectedAgent: AgentType;
  confidence: number;
  reasoning: string;
}

import type { Message } from './message';
import type { ToolCallRequest } from './tool';
