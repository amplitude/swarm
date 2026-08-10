import Dexie, { type EntityTable } from 'dexie';

export interface DBConversation {
  id: string;
  title: string;
  activeAgent: string;
  createdAt: number;
  updatedAt: number;
}

export interface DBMessage {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  agentType?: string;
  toolCall?: string;
  toolResult?: string;
  artifacts?: string;
  timestamp: number;
  metadata?: string;
}

export interface DBArtifact {
  id: string;
  conversationId: string;
  type: string;
  name: string;
  content: string;
  language?: string;
  creatorAgent: string;
  sharedWith?: string;
  handoffId?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DBSetting {
  key: string;
  value: string;
}

const db = new Dexie('AgenticWebApp') as Dexie & {
  conversations: EntityTable<DBConversation, 'id'>;
  messages: EntityTable<DBMessage, 'id'>;
  artifacts: EntityTable<DBArtifact, 'id'>;
  settings: EntityTable<DBSetting, 'key'>;
};

db.version(1).stores({
  conversations: 'id, title, createdAt, updatedAt',
  messages: 'id, conversationId, role, agentType, timestamp',
  artifacts: 'id, conversationId, type, name, createdAt',
  settings: 'key',
});

db.version(2).stores({
  conversations: 'id, title, createdAt, updatedAt',
  messages: 'id, conversationId, role, agentType, timestamp',
  artifacts: 'id, conversationId, type, name, creatorAgent, createdAt',
  settings: 'key',
}).upgrade((tx) => {
  return tx.table('artifacts').toCollection().modify((artifact) => {
    if (!artifact.creatorAgent) {
      artifact.creatorAgent = 'general';
    }
  });
});

export { db };

export async function requestPersistentStorage(): Promise<boolean> {
  if (navigator.storage && navigator.storage.persist) {
    return navigator.storage.persist();
  }
  return false;
}
