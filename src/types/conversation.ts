import type { AgentType } from './agent';
import type { Message } from './message';

export interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  activeAgent: AgentType;
  createdAt: number;
  updatedAt: number;
}
