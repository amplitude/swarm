import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../../store/app-store';
import { Loader2, AlertTriangle, RefreshCw, X, Cpu } from 'lucide-react';
import { DEFAULT_MODEL } from '../../llm/engine';
import { getModelEstimatedBytes } from '../../llm/model-capabilities';
import { getProviderConfig } from '../../llm/provider-singleton';
import { checkWebGPUSupport } from '../../llm/engine';
import { useLLM } from '../../hooks/useLLM';

/**
 * ModelStatus — compact, nonblocking model download/progress indicator.
 *
 * States:
 * - idle: hidden
 * - checking: briefly shown while checking WebGPU
 * - loading: compact progress bar with percentage
 * - ready: success indicator (auto-hides after timeout)
 * - error: error message with retry button
 * - unavailable: WebGPU not available — no model can run. Shows message + retry.
 *
 * No demo mode. If WebGPU is unavailable, the user sees a clear message
 * and the send button is disabled (handled by ChatInput).
 */

export function ModelStatus() {
  const llmStatus = useAppStore((s) => s.llmStatus);
  const llmProgress = useAppStore((s) => s.llmProgress);
  const llmModelName = useAppStore((s) => s.llmModelName);
  const llmError = useAppStore((s) => s.llmError);
  const { loadModel } = useLLM();

  const [dismissed, setDismissed] = useState(false);
  const [webgpuChecked, setWebgpuChecked] = useState(false);
  const [webgpuSupported, setWebgpuSupported] = useState<boolean | null>(null);

  const isLoading = llmStatus === 'loading';
  const isError = llmStatus === 'error';
  const isReady = llmStatus === 'ready';
  const isIdle = llmStatus === 'idle';
  const isUnavailable = webgpuSupported === false && isIdle;

  // Check WebGPU on mount and auto-start model loading if available
  useEffect(() => {
    if (webgpuChecked) return;
    setWebgpuChecked(true);

    const config = getProviderConfig();

    checkWebGPUSupport().then(async (result) => {
      if (!result.supported) {
        console.log('[swarm] WebGPU unavailable:', result.error);
        setWebgpuSupported(false);
        setLLMUnavailable(result.error ?? 'WebGPU is not available in this browser.');
        return;
      }

      setWebgpuSupported(true);

      // WebGPU available — try to load the model
      const lastModel = localStorage.getItem('swarm-last-model');
      const modelToLoad = lastModel || config.modelId || DEFAULT_MODEL;

      console.log(`[swarm] WebGPU available — loading model "${modelToLoad}"`);
      loadModel(modelToLoad);
    });
  }, [webgpuChecked, loadModel]);

  // Auto-dismiss ready state after timeout
  useEffect(() => {
    if (isReady) {
      const timer = setTimeout(() => setDismissed(true), 3000);
      return () => clearTimeout(timer);
    }
  }, [isReady]);

  // Show error state (don't auto-dismiss errors)
  useEffect(() => {
    if (isError) {
      setDismissed(false);
    }
  }, [isError]);

  const handleRetry = useCallback(async () => {
    setDismissed(false);

    // Re-check WebGPU — might have become available
    const result = await checkWebGPUSupport();
    if (!result.supported) {
      setWebgpuSupported(false);
      setLLMUnavailable(result.error ?? 'WebGPU is not available in this browser.');
      return;
    }

    setWebgpuSupported(true);
    const config = getProviderConfig();
    const modelToLoad = llmModelName || config.modelId || DEFAULT_MODEL;
    await loadModel(modelToLoad);
  }, [loadModel, llmModelName]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Don't render anything if idle+dismissed or ready+dismissed
  if ((isIdle && dismissed && webgpuSupported !== false) || (isReady && dismissed)) return null;

  const percent = Math.round(llmProgress * 100);
  const modelSizeBytes = getModelEstimatedBytes(llmModelName || DEFAULT_MODEL) || 180 * 1024 * 1024;
  const downloadedMB = Math.round((modelSizeBytes / (1024 * 1024)) * (llmProgress || 0));
  const totalMB = Math.round(modelSizeBytes / (1024 * 1024));

  // --- Checking WebGPU briefly ---
  if (webgpuSupported === null && !isLoading && !isReady && !isError) {
    return (
      <div className="border-b border-info-500/20 bg-info-500/10 px-4 py-2">
        <div className="flex items-center gap-2 text-xs">
          <Loader2 size={14} className="animate-spin shrink-0 text-info-400" />
          <span className="text-info-300">Checking WebGPU availability...</span>
        </div>
      </div>
    );
  }

  // --- WebGPU unavailable (no demo fallback) ---
  if (isUnavailable || (webgpuSupported === false && isIdle)) {
    return (
      <div className="border-b border-danger-500/20 bg-danger-500/10 px-4 py-2">
        <div className="flex items-center gap-2 text-xs">
          <AlertTriangle size={14} className="shrink-0 text-danger-400" />
          <span className="font-medium text-danger-300">WebGPU Unavailable</span>
          <span className="text-danger-200/70 truncate max-w-[400px]">
            Local AI inference requires WebGPU (Chrome 113+, Edge 113+). 
            Chat is available for drafting only.
          </span>
          <div className="flex-1" />
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 rounded px-2 py-1 text-2xs font-medium text-danger-300 hover:bg-danger-500/20 transition-colors"
          >
            <RefreshCw size={11} />
            Retry
          </button>
          <button
            onClick={handleDismiss}
            className="rounded p-1 text-text-tertiary hover:text-text-secondary hover:bg-surface-raised transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  // --- Loading state (compact inline) ---
  if (isLoading) {
    return (
      <div className="border-b border-info-500/20 bg-info-500/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <Loader2 size={14} className="animate-spin shrink-0 text-info-400" />
          <span className="text-xs font-medium text-info-300">
            Downloading model<span className="animate-pulse">...</span>
          </span>
          <span className="text-2xs text-info-200/70">
            {downloadedMB} / {totalMB} MB ({percent}%)
          </span>
          <div className="flex-1" />
          <span className="text-2xs text-text-tertiary">
            {llmModelName || DEFAULT_MODEL}
          </span>
        </div>
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-overlay">
          <div
            className="h-full rounded-full bg-info-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
    );
  }

  // --- Error state (compact inline) ---
  if (isError) {
    return (
      <div className="border-b border-danger-500/20 bg-danger-500/10 px-4 py-2">
        <div className="flex items-center gap-2">
          <AlertTriangle size={14} className="shrink-0 text-danger-400" />
          <span className="text-xs font-medium text-danger-300">Model load failed</span>
          <span className="text-2xs text-danger-200/70 truncate max-w-[300px]">
            {llmError?.split('\n')[0] ?? 'Unknown error'}
          </span>
          <div className="flex-1" />
          <button
            onClick={handleRetry}
            className="flex items-center gap-1 rounded px-2 py-1 text-2xs font-medium text-danger-300 hover:bg-danger-500/20 transition-colors"
          >
            <RefreshCw size={11} />
            Retry
          </button>
          <button
            onClick={handleDismiss}
            className="rounded p-1 text-text-tertiary hover:text-text-secondary hover:bg-surface-raised transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  // --- Ready state (brief success indicator) ---
  if (isReady) {
    return (
      <div className="border-b border-success-500/20 bg-success-500/10 px-4 py-2 animate-fade-in">
        <div className="flex items-center gap-2 text-xs">
          <Cpu size={14} className="text-success-400" />
          <span className="font-medium text-success-300">Model ready</span>
          <span className="text-success-200/70">{llmModelName}</span>
          <div className="flex-1" />
          <button
            onClick={handleDismiss}
            className="rounded p-1 text-text-tertiary hover:text-text-secondary transition-colors"
          >
            <X size={12} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}

/**
 * Set the LLM status to 'error' with a WebGPU-unavailable message.
 */
function setLLMUnavailable(error: string): void {
  const store = useAppStore.getState();
  store.setLLMStatus('error');
  store.setLLMError(error);
}
