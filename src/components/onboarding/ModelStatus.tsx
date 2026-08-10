import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '../../store/app-store';
import { Loader2, AlertTriangle, RefreshCw, X, Cpu, Wifi, Bot } from 'lucide-react';
import { DEFAULT_MODEL, MLC_AUTO_MODELS } from '../../llm/engine';
import { getModelEstimatedBytes } from '../../llm/model-capabilities';
import { getProviderConfig, setProviderConfig, resetProvider } from '../../llm/provider-singleton';
import { checkWebGPUSupport } from '../../llm/engine';
import { useLLM } from '../../hooks/useLLM';

/**
 * ModelStatus — compact, nonblocking model download/progress indicator.
 *
 * Replaces the old full-screen ModelLoadingOverlay. Never obscures the app.
 *
 * States:
 * - idle: hidden (or "no model loaded")
 * - loading: compact progress bar with percentage + cancel button
 * - ready: success indicator (auto-hides after timeout)
 * - error: error message with retry button
 * - demo: labeled demo mode with retry + Ollama option
 *
 * The component self-dismisses and can be re-shown via the status bar.
 */

export function ModelStatus() {
  const llmStatus = useAppStore((s) => s.llmStatus);
  const llmProgress = useAppStore((s) => s.llmProgress);
  const llmModelName = useAppStore((s) => s.llmModelName);
  const llmError = useAppStore((s) => s.llmError);
  const { loadModel, unload } = useLLM();

  const [dismissed, setDismissed] = useState(false);
  const [demoMode, setDemoMode] = useState(false);
  const [webgpuChecked, setWebgpuChecked] = useState(false);
  const [showDetails] = useState(false);

  const isDemo = llmModelName === 'demo/demo-mode' || demoMode;
  const isLoading = llmStatus === 'loading';
  const isError = llmStatus === 'error';
  const isReady = llmStatus === 'ready' && !isDemo;
  const isIdle = llmStatus === 'idle' && !isDemo;

  // Check WebGPU on mount and auto-start model loading if available
  useEffect(() => {
    if (webgpuChecked) return;
    setWebgpuChecked(true);

    const config = getProviderConfig();

    // If already in demo mode, don't re-check
    if (config.provider === 'demo') {
      setDemoMode(true);
      return;
    }

    // If user is on Ollama, don't check WebGPU
    if (config.provider === 'ollama') {
      return;
    }

    // Check WebGPU for WebLLM default
    checkWebGPUSupport().then(async (result) => {
      if (!result.supported) {
        console.log('[swarm] WebGPU unavailable — entering demo mode');
        setDemoMode(true);
        setProviderConfig({ provider: 'demo' });
        resetProvider();
        // Load the demo provider
        await loadModel('demo/demo-mode');
        return;
      }

      // WebGPU available — try to load default model
      const lastModel = localStorage.getItem('swarm-last-model');
      const modelToLoad = lastModel || config.modelId || DEFAULT_MODEL;

      if (modelToLoad === 'demo/demo-mode') return;

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
    setDemoMode(false);
    const config = getProviderConfig();

    // If currently in demo mode, try WebLLM again
    if (config.provider === 'demo') {
      // Check if WebGPU works now
      const result = await checkWebGPUSupport();
      if (!result.supported) {
        // Still no WebGPU, stay in demo
        return;
      }
      // Switch back to WebLLM
      setProviderConfig({ provider: 'webllm' });
      resetProvider();
      await loadModel(DEFAULT_MODEL);
      return;
    }

    // Retry current provider/model
    const modelToLoad = llmModelName || config.modelId || DEFAULT_MODEL;
    if (modelToLoad === 'demo/demo-mode') return;
    await loadModel(modelToLoad);
  }, [loadModel, llmModelName]);

  const handleRetryWebLLM = useCallback(async () => {
    setDismissed(false);
    setDemoMode(false);
    setProviderConfig({ provider: 'webllm', modelId: DEFAULT_MODEL });
    resetProvider();
    await loadModel(DEFAULT_MODEL);
  }, [loadModel]);

  const handleConfigureOllama = useCallback(() => {
    setDismissed(true);
    // Open settings to model tab — the ModelConfig component has the Ollama section
    useAppStore.getState().setSettingsOpen(true);
  }, []);

  const handleCancel = useCallback(async () => {
    await unload();
    // Enter demo mode instead of leaving idle
    setDemoMode(true);
    setProviderConfig({ provider: 'demo' });
    resetProvider();
    loadModel('demo/demo-mode');
  }, [unload, loadModel]);

  const handleDismiss = useCallback(() => {
    setDismissed(true);
  }, []);

  // Don't render anything if idle, dismissed, or ready+dismissed
  if (isIdle && dismissed) return null;
  if (isReady && dismissed) return null;
  if (llmStatus === 'generating' && dismissed) return null;

  // Estimated download size for the WebLLM model
  const modelInfo = MLC_AUTO_MODELS.find((m) => m.id === DEFAULT_MODEL);
  const estimatedSize = modelInfo?.size ?? '~200 MB';
  const modelSizeBytes = getModelEstimatedBytes(DEFAULT_MODEL) || 200 * 1024 * 1024;
  const percent = Math.round(llmProgress * 100);
  const downloadedMB = Math.round((modelSizeBytes / (1024 * 1024)) * (llmProgress || 0));
  const totalMB = Math.round(modelSizeBytes / (1024 * 1024));

  // --- Demo mode indicator (compact, inline, nonblocking) ---
  if (isDemo) {
    return (
      <div className="border-b border-warning-500/20 bg-warning-500/10 px-4 py-2">
        <div className="flex items-center gap-2 text-xs">
          <Bot size={14} className="shrink-0 text-warning-400" />
          <span className="font-medium text-warning-300">Demo Mode</span>
          <span className="text-warning-200/70">—</span>
          <span className="text-warning-200/70">
            No AI model loaded. UI is fully functional with template responses.
          </span>
          <div className="flex-1" />
          <button
            onClick={handleRetryWebLLM}
            className="flex items-center gap-1 rounded px-2 py-1 text-2xs font-medium text-warning-300 hover:bg-warning-500/20 transition-colors"
          >
            <RefreshCw size={11} />
            Retry WebLLM
          </button>
          <button
            onClick={handleConfigureOllama}
            className="flex items-center gap-1 rounded px-2 py-1 text-2xs text-text-tertiary hover:bg-surface-raised transition-colors"
          >
            <Wifi size={11} />
            Ollama (expert)
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
            Downloading model...
          </span>
          <span className="text-2xs text-info-200/70">
            {downloadedMB} / {totalMB} MB ({percent}%)
          </span>
          <div className="flex-1" />
          <button
            onClick={handleCancel}
            className="flex items-center gap-1 rounded px-2 py-1 text-2xs text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
          >
            <X size={11} />
            Cancel
          </button>
        </div>
        {/* Progress bar */}
        <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-overlay">
          <div
            className="h-full rounded-full bg-info-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        {showDetails && (
          <p className="mt-1 text-2xs text-text-tertiary">
            Model: {llmModelName || DEFAULT_MODEL} &middot;
            Estimated size: {estimatedSize} &middot;
            Cached after first download
          </p>
        )}
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
            onClick={handleCancel}
            className="flex items-center gap-1 rounded px-2 py-1 text-2xs text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
          >
            Demo mode
          </button>
          <button
            onClick={handleDismiss}
            className="rounded p-1 text-text-tertiary hover:text-text-secondary hover:bg-surface-raised transition-colors"
          >
            <X size={12} />
          </button>
        </div>
        {showDetails && llmError && (
          <p className="mt-1 text-2xs text-danger-200/70 whitespace-pre-wrap">{llmError}</p>
        )}
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
