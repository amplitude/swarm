import { useCallback, useRef } from 'react';
import { useAppStore } from '@/store/app-store';
import { getSharedProvider } from '@/llm/provider-singleton';
import type { LLMRequest, LLMStreamChunk } from '@/llm/engine';
import { clearSpecificModelCache, checkStorageForDownload } from '@/utils/storage-cleanup';
import { getModelEstimatedBytes } from '@/llm/model-capabilities';

function getProvider() {
  return getSharedProvider();
}

export function useLLM() {
  const setLLMStatus = useAppStore((s) => s.setLLMStatus);
  const setLLMProgress = useAppStore((s) => s.setLLMProgress);
  const setLLMModelName = useAppStore((s) => s.setLLMModelName);
  const setLLMError = useAppStore((s) => s.setLLMError);
  const llmStatus = useAppStore((s) => s.llmStatus);
  const llmModelName = useAppStore((s) => s.llmModelName);
  const abortRef = useRef<AbortController | null>(null);

  const loadModel = useCallback(async (modelId: string) => {
    const provider = getProvider();

    if (provider.getLoadedModel() === modelId) {
      setLLMStatus('ready');
      return;
    }

    const previousModelId = provider.getLoadedModel();

    try {
      setLLMStatus('loading');
      setLLMProgress(0);
      setLLMError(null);

      const estimatedBytes = getModelEstimatedBytes(modelId);
      if (estimatedBytes > 0) {
        const storageCheck = await checkStorageForDownload(estimatedBytes);
        console.log(`[swarm] Storage check: ${(storageCheck.availableBytes / (1024 * 1024 * 1024)).toFixed(1)} GB available, need ${(storageCheck.needed / (1024 * 1024 * 1024)).toFixed(1)} GB`);
        if (!storageCheck.hasSpace && previousModelId && previousModelId !== modelId) {
          console.log(`[swarm] Low storage: clearing previous model cache (${previousModelId})`);
          await clearSpecificModelCache(previousModelId);
        }
      }

      await provider.load(modelId, (progress, _text) => {
        setLLMProgress(progress);
      });

      setLLMModelName(modelId);
      setLLMStatus('ready');
      console.log(`[swarm] Model "${modelId}" loaded successfully`);
      localStorage.setItem('swarm-last-model', modelId);

      if (previousModelId && previousModelId !== modelId) {
        clearSpecificModelCache(previousModelId).catch((err) =>
          console.warn('[swarm] Failed to clear previous model cache:', err),
        );
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setLLMError(message);
      setLLMStatus('error');
    }
  }, [setLLMStatus, setLLMProgress, setLLMModelName, setLLMError]);

  const generate = useCallback(async function* (
    request: LLMRequest
  ): AsyncGenerator<LLMStreamChunk> {
    const provider = getProvider();
    if (!provider.isLoaded()) {
      throw new Error('Model not loaded. Call loadModel() first.');
    }

    setLLMStatus('generating');
    abortRef.current = new AbortController();

    try {
      for await (const chunk of provider.generate(request)) {
        if (abortRef.current?.signal.aborted) break;
        yield chunk;
      }
    } finally {
      setLLMStatus('ready');
      abortRef.current = null;
    }
  }, [setLLMStatus]);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const unload = useCallback(async () => {
    const provider = getProvider();
    await provider.unload();
    setLLMModelName(null);
    setLLMStatus('idle');
  }, [setLLMModelName, setLLMStatus]);

  return {
    loadModel,
    generate,
    abort,
    unload,
    isLoaded: llmStatus === 'ready' || llmStatus === 'generating',
    isGenerating: llmStatus === 'generating',
    modelName: llmModelName,
    status: llmStatus,
  };
}
