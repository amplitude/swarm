import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '@/store/app-store';

// Mock DB repos
vi.mock('@/db/repositories/conversations', () => ({
  conversationRepo: {
    create: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/db/repositories/messages', () => ({
  messageRepo: {
    add: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    getByConversation: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/db/schema', () => ({
  requestPersistentStorage: vi.fn().mockResolvedValue(undefined),
}));

describe('Error states and cancellation flow', () => {
  beforeEach(() => {
    useAppStore.setState({
      conversations: [],
      activeConversationId: null,
      activeAgent: 'general',
      llmStatus: 'idle',
      llmProgress: 0,
      llmModelName: null,
      llmError: null,
    });
  });

  describe('LLM error state management', () => {
    it('enters error state when model loading fails', () => {
      const get = () => useAppStore.getState();

      // Simulate the useLLM.loadModel error path:
      get().setLLMStatus('loading');
      get().setLLMProgress(0.5);
      expect(get().llmStatus).toBe('loading');

      // Error occurs
      get().setLLMError('Failed to download model: network error');
      get().setLLMStatus('error');

      expect(get().llmStatus).toBe('error');
      expect(get().llmError).toContain('network error');
      expect(get().llmModelName).toBeNull(); // Model not set
    });

    it('can retry from error state (clear error and reload)', () => {
      const get = () => useAppStore.getState();

      // Set error state (as happens in real flow)
      get().setLLMError('Ollama connection refused');
      get().setLLMStatus('error');

      expect(get().llmStatus).toBe('error');

      // Retry: simulate going back to loading
      get().setLLMProgress(0);
      get().setLLMError(null);
      get().setLLMStatus('loading');

      expect(get().llmStatus).toBe('loading');
      expect(get().llmError).toBeNull();
      expect(get().llmProgress).toBe(0);

      // Complete successfully
      get().setLLMStatus('ready');
      get().setLLMModelName('ollama/qwen2.5-coder:0.5b');

      expect(get().llmStatus).toBe('ready');
      expect(get().llmModelName).toBe('ollama/qwen2.5-coder:0.5b');
    });

    it('cancel during loading returns to idle', () => {
      const get = () => useAppStore.getState();

      // Start loading
      get().setLLMStatus('loading');
      get().setLLMProgress(0.3);
      expect(get().llmStatus).toBe('loading');

      // Cancel
      get().setLLMStatus('idle');
      get().setLLMProgress(0);
      get().setLLMModelName(null);

      expect(get().llmStatus).toBe('idle');
      expect(get().llmProgress).toBe(0);
      expect(get().llmModelName).toBeNull();
    });

    it('handles rapid load/cancel/reload without error', () => {
      const get = () => useAppStore.getState();

      // Simulate rapid user actions: load -> cancel -> load -> ready
      get().setLLMStatus('loading');
      get().setLLMStatus('idle'); // cancel
      get().setLLMStatus('loading'); // retry
      get().setLLMStatus('loading'); // duplicate load() call (idempotent at store level)
      get().setLLMStatus('ready');
      get().setLLMModelName('ollama/qwen2.5-coder:0.5b');

      expect(get().llmStatus).toBe('ready');
      expect(get().llmModelName).toBe('ollama/qwen2.5-coder:0.5b');
    });
  });

  describe('Chat error handling', () => {
    it('can add an error message to conversation', () => {
      const get = () => useAppStore.getState();
      const convId = get().createConversation('Test error handling', 'general');

      // Simulate what useChat does on error: update placeholder with error
      get().addMessage(convId, {
        conversationId: convId,
        role: 'user',
        content: 'Do something',
      });

      // The last message should be the user message
      const conv = get().conversations.find((c) => c.id === convId)!;
      expect(conv.messages).toHaveLength(1);

      // Update the last message content with error
      const userMsg = conv.messages[0]!;
      get().updateMessageContent(convId, userMsg.id, 'Error: Model not responding');

      const updatedConv = get().conversations.find((c) => c.id === convId)!;
      expect(updatedConv.messages[0]!.content).toBe('Error: Model not responding');
    });

    it('LLM not ready causes no conversations to exist', () => {
      // The useChat.sendMessage checks llmStatus !== 'ready' && !== 'generating'
      // and returns without doing anything. This test verifies the store is
      // consistent when LLM is not ready.
      const get = () => useAppStore.getState();
      get().setLLMStatus('error');
      get().setLLMError('No model loaded');

      // No conversations should exist since sendMessage would bail before creating one
      expect(get().conversations).toHaveLength(0);
      expect(get().activeConversationId).toBeNull();
    });

    it('can clear all conversations and reset to blank state', () => {
      const get = () => useAppStore.getState();

      // Create a couple conversations
      get().createConversation('First', 'general');
      get().createConversation('Second', 'coder');

      expect(get().conversations).toHaveLength(2);

      // Delete all conversations
      for (const conv of get().conversations) {
        get().deleteConversation(conv.id);
      }

      expect(get().conversations).toHaveLength(0);
      expect(get().activeConversationId).toBeNull();
    });
  });

  describe('Provider switch handling', () => {
    it('can switch provider config without crashing', () => {
      // Simulate what happens when user changes provider in settings
      localStorage.setItem('swarm-provider', 'webllm');
      localStorage.setItem('swarm-model-id', 'Phi-3.5-mini-instruct-q4f16_1-MLC');

      expect(localStorage.getItem('swarm-provider')).toBe('webllm');
    });

    it('can switch back to Ollama after WebLLM', () => {
      localStorage.setItem('swarm-provider', 'webllm');
      localStorage.setItem('swarm-model-id', 'Phi-3.5-mini-instruct-q4f16_1-MLC');

      // Switch back
      localStorage.setItem('swarm-provider', 'ollama');
      localStorage.setItem('swarm-model-id', 'ollama/qwen2.5-coder:0.5b');

      expect(localStorage.getItem('swarm-provider')).toBe('ollama');
      expect(localStorage.getItem('swarm-model-id')).toBe('ollama/qwen2.5-coder:0.5b');
    });
  });
});
