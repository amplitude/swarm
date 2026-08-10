import type { AgentType } from './agent';

export type DecisionType = 'handoff' | 'tool_approval' | 'agent_question' | 'config_choice';
export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'expired';

export interface DecisionOption {
  id: string;
  label: string;
  variant: 'primary' | 'danger' | 'neutral';
  tier?: 'once' | 'route' | 'all';
}

export interface Decision {
  id: string;
  type: DecisionType;
  agentType: AgentType;
  title: string;
  description: string;
  options: DecisionOption[];
  status: DecisionStatus;
  createdAt: number;
  resolvedAt?: number;
  resolvedOptionId?: string;
  metadata?: Record<string, unknown>;
}
