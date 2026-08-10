import { useAppStore } from '../../store/app-store';
import { MessageList } from './MessageList';
import { ChatInput } from './ChatInput';
import { Bot } from 'lucide-react';

export function ChatPanel() {
  const activeConversationId = useAppStore((s) => s.activeConversationId);
  const activeAgent = useAppStore((s) => s.activeAgent);
  const createConversation = useAppStore((s) => s.createConversation);

  if (!activeConversationId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-500/10">
          <Bot size={24} className="text-primary-400" />
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold text-text-primary">Welcome to Swarm</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Start a new conversation to begin chatting with an AI agent.
          </p>
        </div>
        <button
          onClick={() => createConversation(undefined, activeAgent)}
          className="mt-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-500 transition-colors"
        >
          New conversation
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <MessageList />
      <ChatInput />
    </div>
  );
}
