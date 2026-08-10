import type { StateCreator } from 'zustand';

export type LLMStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error';

export interface LLMSlice {
  llmStatus: LLMStatus;
  llmProgress: number;
  llmModelName: string | null;
  llmError: string | null;
  tokensPerSecond: number;
  vramUsageMB: number;

  setLLMStatus: (status: LLMStatus) => void;
  setLLMProgress: (progress: number) => void;
  setLLMModelName: (name: string | null) => void;
  setLLMError: (error: string | null) => void;
  setTokensPerSecond: (tps: number) => void;
  setVramUsage: (mb: number) => void;
}

export const createLLMSlice: StateCreator<LLMSlice, [], [], LLMSlice> = (set) => ({
  llmStatus: 'idle',
  llmProgress: 0,
  llmModelName: null,
  llmError: null,
  tokensPerSecond: 0,
  vramUsageMB: 0,

  setLLMStatus: (status) => set({ llmStatus: status }),
  setLLMProgress: (progress) => set({ llmProgress: progress }),
  setLLMModelName: (name) => set({ llmModelName: name }),
  setLLMError: (error) => set({ llmError: error }),
  setTokensPerSecond: (tps) => set({ tokensPerSecond: tps }),
  setVramUsage: (mb) => set({ vramUsageMB: mb }),
});
