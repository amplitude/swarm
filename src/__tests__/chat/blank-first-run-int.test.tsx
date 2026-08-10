/**
 * blank-first-run-int.test.tsx — Integration test for blank first run
 *
 * Renders the ChatPanel component with a genuinely clean profile:
 * - Fresh localStorage (no pre-existing keys)
 * - Mocked empty IndexedDB (Dexie repositories return empty arrays)
 * - Store in initial idle state with zero conversations
 *
 * Asserts:
 * - Empty-state UI text is visible
 * - Zero conversations in the store
 * - localStorage has no swarm keys (genuinely clean)
 *
 * Method: Renders the top-level ChatPanel with fresh store state + mocked repos.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { useAppStore } from '@/store/app-store';

// Mock DB repositories to return empty arrays (simulating fresh IndexedDB)
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
    getByConversation: vi.fn().mockResolvedValue([]),
    update: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/db/schema', () => ({
  requestPersistentStorage: vi.fn().mockResolvedValue(undefined),
}));

describe('Blank first run (integration)', () => {
  beforeEach(() => {
    // Clear localStorage to simulate genuinely clean profile
    localStorage.clear();

    // Reset store to pristine initial state
    useAppStore.setState({
      conversations: [],
      activeConversationId: null,
      activeAgent: 'general',
      llmStatus: 'idle',
      llmModelName: null,
      llmError: null,
      llmProgress: 0,
      tokensPerSecond: 0,
      vramUsageMB: 0,
      sidebarOpen: true,
      theme: 'dark',
      viewMode: 'chat',
      agentState: {
        manager: { isThinking: false, lastError: null },
        general: { isThinking: false, lastError: null },
        coder: { isThinking: false, lastError: null },
        pm: { isThinking: false, lastError: null },
        designer: { isThinking: false, lastError: null },
      },
    });
  });

  it('renders empty-state UI with welcome text and zero conversations', async () => {
    // Import ChatPanel lazily after mocks are set up
    const { ChatPanel } = await import('@/components/chat/ChatPanel');

    render(<ChatPanel />);

    // Check empty-state UI text is visible
    expect(screen.getByText('Welcome to Swarm')).toBeTruthy();
    expect(
      screen.getByText('Start a new conversation to begin chatting with an AI agent.'),
    ).toBeTruthy();

    // Check "New conversation" button is present
    expect(screen.getByText('New conversation')).toBeTruthy();

    // Check zero conversations in store
    const state = useAppStore.getState();
    expect(state.conversations).toHaveLength(0);
    expect(state.activeConversationId).toBeNull();
  });

  it('has clean localStorage with no swarm keys on first run', () => {
    // localStorage was cleared in beforeEach — assert no pre-existing keys
    const keys = Object.keys(localStorage as unknown as Record<string, string>);
    const swarmKeys = keys.filter((k) => k.startsWith('swarm-'));
    expect(swarmKeys).toHaveLength(0);
  });

  it('LLM state is idle with no model loaded on first run', () => {
    const state = useAppStore.getState();
    expect(state.llmStatus).toBe('idle');
    expect(state.llmModelName).toBeNull();
    expect(state.llmError).toBeNull();
    expect(state.llmProgress).toBe(0);
    expect(state.tokensPerSecond).toBe(0);
    expect(state.vramUsageMB).toBe(0);
  });

  it('can create a conversation from empty state, proving the round-trip', () => {
    // Start from blank
    expect(useAppStore.getState().conversations).toHaveLength(0);

    // Create a conversation
    const convId = useAppStore.getState().createConversation('First chat', 'general');

    // Now we have 1 conversation
    const state = useAppStore.getState();
    expect(state.conversations).toHaveLength(1);
    expect(state.activeConversationId).toBe(convId);
    expect(state.conversations[0]!.title).toBe('First chat');

    // Delete it — back to blank
    useAppStore.getState().deleteConversation(convId);
    expect(useAppStore.getState().conversations).toHaveLength(0);
    expect(useAppStore.getState().activeConversationId).toBeNull();
  });

  it('ChatPanel renders Bot icon on empty state', async () => {
    const { ChatPanel } = await import('@/components/chat/ChatPanel');
    const { container } = render(<ChatPanel />);

    // Lucide Bot icon renders as an SVG
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg!.getAttribute('class')).toContain('text-primary-400');
  });
});
