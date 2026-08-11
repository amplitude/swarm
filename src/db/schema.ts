import Dexie, { type EntityTable } from 'dexie';

export interface DBConversation {
  id: string;
  title: string;
  activeAgent: string;
  sessionId: string;
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

export interface DBSession {
  id: string;
  name: string;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
  schemaVersion: number;
}

export interface DBTask {
  id: string;
  sessionId: string;
  conversationId: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  assignedAgent?: string;
  createdAt: number;
  updatedAt: number;
  completedAt?: number;
}

const db = new Dexie('swarm') as Dexie & {
  conversations: EntityTable<DBConversation, 'id'>;
  messages: EntityTable<DBMessage, 'id'>;
  artifacts: EntityTable<DBArtifact, 'id'>;
  settings: EntityTable<DBSetting, 'key'>;
  sessions: EntityTable<DBSession, 'id'>;
  tasks: EntityTable<DBTask, 'id'>;
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

db.version(3).stores({
  conversations: 'id, title, createdAt, updatedAt',
  messages: 'id, conversationId, role, agentType, timestamp',
  artifacts: 'id, conversationId, type, name, creatorAgent, createdAt',
  settings: 'key',
  sessions: 'id, sortOrder, createdAt, updatedAt',
  tasks: 'id, sessionId, conversationId, status, createdAt, updatedAt',
}).upgrade(async (tx) => {
  // Create a default session for existing data
  const existingConversations = await tx.table('conversations').toArray();
  if (existingConversations.length > 0) {
    await tx.table('sessions').add({
      id: 'default',
      name: 'Default',
      sortOrder: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      schemaVersion: 1,
    });
  }
});

db.version(4).stores({
  conversations: 'id, sessionId, title, createdAt, updatedAt',
  messages: 'id, conversationId, role, agentType, timestamp',
  artifacts: 'id, conversationId, type, name, creatorAgent, createdAt',
  settings: 'key',
  sessions: 'id, sortOrder, createdAt, updatedAt',
  tasks: 'id, sessionId, conversationId, status, createdAt, updatedAt',
}).upgrade(async (tx) => {
  // Add sessionId to existing conversations
  const defaultSession = await tx.table('sessions').get('default');
  const sessionId = defaultSession?.id || 'default';
  await tx.table('conversations').toCollection().modify((conv) => {
    if (!conv.sessionId) {
      conv.sessionId = sessionId;
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
