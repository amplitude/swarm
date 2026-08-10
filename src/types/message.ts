import type { AgentType } from './agent';
import type { ToolCallRequest, ToolResult, Artifact } from './tool';

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

export interface Message {
  id: string;
  conversationId: string;
  role: MessageRole;
  content: string;
  agentType?: AgentType;
  toolCall?: ToolCallRequest;
  toolResult?: ToolResult;
  artifacts?: Artifact[];
  timestamp: number;
  metadata?: Record<string, unknown>;
}
