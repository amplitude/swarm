import { describe, it, expect } from 'vitest';
import { useAppStore } from '@/store/app-store';

describe('LLM State Transitions', () => {
  it('initial state is idle', () => {
    const state = useAppStore.getState();
    expect(state.llmStatus).toBe('idle');
    expect(state.llmProgress).toBe(0);
    expect(state.llmModelName).toBeNull();
    expect(state.llmError).toBeNull();
  });

  it('setLLMStatus transitions through states', () => {
    const store = useAppStore.getState();

    store.setLLMStatus('loading');
    expect(useAppStore.getState().llmStatus).toBe('loading');

    store.setLLMProgress(0.5);
    expect(useAppStore.getState().llmProgress).toBe(0.5);

    store.setLLMModelName('test-model');
    expect(useAppStore.getState().llmModelName).toBe('test-model');

    store.setLLMStatus('ready');
    expect(useAppStore.getState().llmStatus).toBe('ready');

    store.setLLMError('test error');
    expect(useAppStore.getState().llmError).toBe('test error');

    store.setLLMStatus('error');
    expect(useAppStore.getState().llmStatus).toBe('error');
  });

  it('setAgentThinking toggles thinking state per agent', () => {
    const store = useAppStore.getState();

    expect(store.agentState.manager.isThinking).toBe(false);
    store.setAgentThinking('manager', true);
    expect(useAppStore.getState().agentState.manager.isThinking).toBe(true);
    store.setAgentThinking('manager', false);
    expect(useAppStore.getState().agentState.manager.isThinking).toBe(false);
  });
});
