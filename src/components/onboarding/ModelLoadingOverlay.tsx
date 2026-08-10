import { useEffect, useState, useCallback } from 'react';
import { Bot, AlertTriangle, RefreshCw, Download, HardDrive, X, Check, Trash2, Loader2, Play, Wifi, ArrowRight } from 'lucide-react';
import type { LLMStatus } from '../../store/slices/llm-slice';
import {
  getStorageUsage,
  listCachedModels,
  clearAllModelCaches,
  clearSpecificModelCache,
  type CachedModelInfo,
} from '../../utils/storage-cleanup';
import { RECOMMENDED_MODELS, DEFAULT_MODEL } from '../../llm/engine';
import { getModelEstimatedBytes } from '../../llm/model-capabilities';



interface ModelLoadingOverlayProps {
  status: LLMStatus;
  progress: number;
  error: string | null;
  /** True when this is a first-ever visit (no cached model) */
  isFirstRun: boolean;
  onStart: () => void;
  onCancel: () => void;
  onRetry: () => void;
}

export function ModelLoadingOverlay({
  status,
  progress,
  error,
  isFirstRun,
  onStart,
  onCancel,
  onRetry,
}: ModelLoadingOverlayProps) {
  const [storageInfo, setStorageInfo] = useState<{ free: number; total: number } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [wasLoading, setWasLoading] = useState(false);
  const [cachedModels, setCachedModels] = useState<CachedModelInfo[]>([]);
  const [clearing, setClearing] = useState(false);
  const [showStorageWarning, setShowStorageWarning] = useState(false);

  const isIdle = status === 'idle';
  const isLoading = status === 'loading';
  const isError = status === 'error';
  const isReady = status === 'ready';
  const isOllama = isLoading && DEFAULT_MODEL.startsWith('ollama/');

  // Determine what model we're loading
  const lastModel = typeof localStorage !== 'undefined' ? localStorage.getItem('swarm-last-model') : null;
  const loadModelId = lastModel || DEFAULT_MODEL;
  const modelInfo = RECOMMENDED_MODELS.find((m) => m.id === loadModelId);
  const modelRuntime = modelInfo?.runtime ?? (loadModelId.startsWith('ollama/') ? 'Ollama' : 'WebLLM');

  const percent = Math.round(progress * 100);
  const estimatedBytes = modelInfo?.size ?? '~4 GB';
  const modelSizeBytes = getModelEstimatedBytes(loadModelId) || 4 * 1024 * 1024 * 1024;
  const isIdleModelOllama = DEFAULT_MODEL.startsWith('ollama/');

  // Track if we were loading (to show success state)
  useEffect(() => {
    if (isLoading) setWasLoading(true);
  }, [isLoading]);

  // Show success briefly when model finishes loading
  useEffect(() => {
    if (isReady && wasLoading) {
      setShowSuccess(true);
      const timer = setTimeout(() => setShowSuccess(false), 1500);
      return () => clearTimeout(timer);
    }
  }, [isReady, wasLoading]);

  const refreshStorageInfo = useCallback(async () => {
    // Read current model from localStorage at call time (avoids stale closures)
    const currentModel = typeof localStorage !== 'undefined' ? localStorage.getItem('swarm-last-model') : null;
    const currentModelSize = getModelEstimatedBytes(currentModel || DEFAULT_MODEL) || 4 * 1024 * 1024 * 1024;
    const usage = await getStorageUsage();
    if (usage) {
      setStorageInfo({ free: usage.availableBytes, total: usage.quotaBytes });
      if (usage.availableBytes < currentModelSize * 1.5) {
        setShowStorageWarning(true);
      }
    }
    const models = await listCachedModels();
    setCachedModels(models.filter((m) => m.cached));
  }, []);

  // Check available storage on mount
  useEffect(() => {
    if (loadModelId.startsWith('ollama/')) {
      // No storage check needed for Ollama
      setStorageInfo({ free: 0, total: 0 });
    } else {
      refreshStorageInfo();
    }
  }, [loadModelId, refreshStorageInfo]);

  const handleClearModel = async (modelId: string) => {
    setClearing(true);
    try {
      await clearSpecificModelCache(modelId);
      await refreshStorageInfo();
    } finally {
      setClearing(false);
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await clearAllModelCaches();
      await refreshStorageInfo();
    } finally {
      setClearing(false);
    }
  };

  // Don't render overlay at all when:
  if (isReady && !showSuccess) return null;
  if (isIdle && !isFirstRun) return null;
  if (status === 'generating') return null;

  const freeGB = storageInfo ? (storageInfo.free / (1024 * 1024 * 1024)).toFixed(1) : null;
  const lowStorage = storageInfo ? storageInfo.free < modelSizeBytes * 3 : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-surface-inset/95 backdrop-blur-sm">
      <div className="w-full max-w-md px-6 text-center">
        {/* Logo */}
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-500/15">
          {showSuccess ? (
            <Check size={28} className="text-success-400" />
          ) : isOllama ? (
            <Wifi size={28} className="text-primary-400" />
          ) : (
            <Bot size={28} className="text-primary-400" />
          )}
        </div>

        {/* --- Success state --- */}
        {showSuccess && (
          <>
            <h2 className="text-xl font-semibold text-text-primary">Ready</h2>
            <p className="mt-1 text-sm text-text-secondary">{modelRuntime} model loaded. Starting Swarm...</p>
          </>
        )}

        {/* --- Initial setup (idle, first visit) --- */}
        {isIdle && !showSuccess && (
          <>
            <h2 className="text-xl font-semibold text-text-primary">Welcome to Swarm</h2>
            <p className="mt-2 text-sm text-text-secondary leading-relaxed">
              {isIdleModelOllama ? (
                <>
                  Swarm connects to your local <strong className="text-text-primary">Ollama</strong> instance to run AI models.
                  Make sure Ollama is running with the model pulled.
                </>
              ) : (
                <>
                  Swarm runs AI entirely in your browser. A one-time download of <strong className="text-text-primary">{estimatedBytes}</strong> is needed
                  to set up the language model.
                </>
              )}
            </p>

            {/* Storage info (only for WebLLM) */}
            {!isIdleModelOllama && freeGB && (
              <div className={`mt-4 flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-xs ${
                lowStorage
                  ? 'border-warning-500/30 bg-warning-500/10 text-warning-300'
                  : 'border-border bg-surface-raised text-text-secondary'
              }`}>
                <HardDrive size={13} />
                <span>
                  {freeGB} GB available
                  {lowStorage && ' — storage may be tight'}
                </span>
              </div>
            )}

            {/* Ollama info block */}
            {isIdleModelOllama && (
              <div className="mt-4 rounded-lg border border-primary-500/20 bg-primary-500/5 px-4 py-3 text-left">
                <p className="text-xs font-medium text-primary-300">Default model: {modelInfo?.name ?? loadModelId}</p>
                <p className="mt-1 text-2xs text-text-tertiary">
                  Runtime: <strong>{modelRuntime}</strong> &middot; Size: {estimatedBytes}
                </p>
                <div className="mt-2 flex items-start gap-2 rounded bg-surface-raised p-2 text-2xs text-text-secondary">
                  <span className="shrink-0 mt-0.5">&#9432;</span>
                  <span>
                    Pull the model: <code className="rounded bg-surface-overlay px-1 text-primary-300">ollama pull qwen2.5-coder:0.5b</code>
                  </span>
                </div>
              </div>
            )}

            {/* Cached models (WebLLM only) */}
            {!isIdleModelOllama && cachedModels.length > 0 && (
              <div className={`mt-4 rounded-lg border p-3 text-left ${
                showStorageWarning
                  ? 'border-warning-500/30 bg-warning-500/5'
                  : 'border-border bg-surface-raised'
              }`}>
                <p className={`text-xs font-medium mb-2 ${showStorageWarning ? 'text-warning-300' : 'text-text-secondary'}`}>
                  {showStorageWarning ? 'Free up space by clearing cached models:' : 'Cached models:'}
                </p>
                <div className="flex flex-col gap-1.5">
                  {cachedModels.map((m) => (
                    <div key={m.modelId} className="flex items-center justify-between text-xs">
                      <span className="text-text-secondary truncate">
                        {m.name} {m.cacheSize && <span className="text-text-tertiary">({m.cacheSize})</span>}
                      </span>
                      <button
                        onClick={() => handleClearModel(m.modelId)}
                        disabled={clearing}
                        className="shrink-0 ml-2 flex items-center gap-1 rounded px-2 py-0.5 text-2xs text-text-tertiary hover:bg-surface-overlay hover:text-text-secondary disabled:opacity-40"
                      >
                        <Trash2 size={10} />
                        Clear
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  onClick={handleClearAll}
                  disabled={clearing}
                  className="mt-2 flex items-center gap-1 rounded px-2 py-1 text-2xs text-danger-300 hover:bg-danger-500/10 disabled:opacity-40"
                >
                  {clearing ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                  Clear all cached data
                </button>
              </div>
            )}

            <button
              onClick={onStart}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary-600 px-4 py-3 text-sm font-medium text-white hover:bg-primary-500 transition-colors"
            >
              {isIdleModelOllama ? (
                <>
                  <Wifi size={16} />
                  Connect to Ollama
                </>
              ) : cachedModels.length > 0 ? (
                <>
                  <Play size={16} />
                  Start
                </>
              ) : (
                <>
                  <Download size={16} />
                  Download & Start
                </>
              )}
            </button>

            <p className="mt-3 text-2xs text-text-tertiary">
              {isIdleModelOllama
                ? 'No data leaves your device. Ollama runs locally on your machine.'
                : 'No data leaves your device. The model is cached for instant loading on future visits.'}
            </p>

            <button
              onClick={onCancel}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-text-tertiary hover:text-text-secondary transition-colors"
            >
              <ArrowRight size={12} />
              Continue without model
            </button>
          </>
        )}

        {/* --- Loading / Connecting --- */}
        {isLoading && !showSuccess && (
          <>
            <h2 className="text-lg font-semibold text-text-primary">
              {isOllama ? 'Connecting to Ollama' : 'Downloading model'}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              {isOllama
                ? 'Connecting to local Ollama instance...'
                : `${formatEstimate(percent, estimatedBytes)}`}
            </p>

            {/* Progress bar */}
            <div
              role="progressbar"
              aria-valuenow={isOllama ? undefined : percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={isOllama ? 'Connecting to Ollama' : `Downloading model: ${percent}%`}
              className="mt-4 h-2 w-full overflow-hidden rounded-full bg-surface-overlay"
            >
              {isOllama ? (
                <div className="h-full rounded-full bg-primary-500 animate-pulse" style={{ width: '60%' }} />
              ) : (
                <div
                  className="h-full rounded-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${percent}%` }}
                />
              )}
            </div>

            <div className="mt-2 flex items-center justify-between text-2xs text-text-tertiary">
              <span>{isOllama ? 'Connecting...' : `${percent}%`}</span>
              <span>{isOllama ? `Model: ${loadModelId.replace('ollama/', '')}` : 'Cached after first download'}</span>
            </div>

            <button
              onClick={onCancel}
              className="mt-4 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-text-tertiary hover:bg-surface-overlay hover:text-text-secondary transition-colors"
            >
              <X size={12} />
              Cancel
            </button>
          </>
        )}

        {/* --- Error --- */}
        {isError && !showSuccess && (
          <>
            <h2 className="text-lg font-semibold text-text-primary">
              {loadModelId.startsWith('ollama/') ? 'Connection failed' : 'Download failed'}
            </h2>

            <div className="mt-3 flex items-start gap-2 rounded-lg border border-danger-500/20 bg-danger-500/10 px-4 py-3 text-left">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-danger-400" />
              <p className="text-xs text-danger-300 whitespace-pre-wrap">{error}</p>
            </div>

            {loadModelId.startsWith('ollama/') && (
              <div className="mt-3 rounded-lg border border-border bg-surface-raised px-4 py-3 text-left text-xs text-text-secondary">
                <p className="font-medium text-text-primary">Troubleshooting:</p>
                <ol className="mt-1 ml-4 list-decimal space-y-1 text-2xs">
                  <li>Ensure Ollama is installed: <code className="rounded bg-surface-overlay px-1">brew install ollama</code></li>
                  <li>Start Ollama: <code className="rounded bg-surface-overlay px-1">ollama serve</code></li>
                  <li>Pull the model: <code className="rounded bg-surface-overlay px-1">ollama pull qwen2.5-coder:0.5b</code></li>
                  <li>Check endpoint: <code className="rounded bg-surface-overlay px-1">curl http://localhost:11434/api/tags</code></li>
                </ol>
              </div>
            )}

            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={onRetry}
                className="inline-flex items-center gap-2 rounded-xl bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-500 transition-colors"
              >
                <RefreshCw size={14} />
                Retry
              </button>
              <button
                onClick={onCancel}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2.5 text-xs text-text-tertiary hover:bg-surface-overlay hover:text-text-secondary transition-colors"
              >
                <ArrowRight size={12} />
                Continue without model
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function formatEstimate(percent: number, total: string): string {
  if (percent <= 0) return 'Starting download...';
  const totalMB = parseFloat(total.replace(/[~ ]*GB/, '')) * 1024;
  if (isNaN(totalMB)) return `${percent}%`;
  const downloadedMB = Math.round(totalMB * percent / 100);
  return `${formatMB(downloadedMB)} / ${total}`;
}

function formatMB(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`;
  return `${mb} MB`;
}
