import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../store/app-store';
import { RECOMMENDED_MODELS } from '../../llm/engine';
import { useLLM } from '../../hooks/useLLM';
import { HardDrive, Zap, Check, Loader2, Download, Trash2, AlertTriangle } from 'lucide-react';
import {
  listCachedModels,
  getStorageUsage,
  clearSpecificModelCache,
  clearAllModelCaches,
  type CachedModelInfo,
  type StorageUsage,
} from '../../utils/storage-cleanup';

export function ModelConfig() {
  const llmModelName = useAppStore((s) => s.llmModelName);
  const llmStatus = useAppStore((s) => s.llmStatus);
  const llmProgress = useAppStore((s) => s.llmProgress);
  const vramUsageMB = useAppStore((s) => s.vramUsageMB);
  const tokensPerSecond = useAppStore((s) => s.tokensPerSecond);
  const { loadModel, unload } = useLLM();

  const isLoading = llmStatus === 'loading';
  const percent = Math.round(llmProgress * 100);

  // Cache management state
  const [cacheEntries, setCacheEntries] = useState<CachedModelInfo[]>([]);
  const [cacheLoading, setCacheLoading] = useState(true);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageUsage | null>(null);

  const refreshCache = useCallback(async () => {
    setCacheLoading(true);
    try {
      const [entries, usage] = await Promise.all([listCachedModels(), getStorageUsage()]);
      setCacheEntries(entries);
      if (usage) setStorageInfo(usage);
    } catch {
      // Silently fail -- cache check is best-effort
    } finally {
      setCacheLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshCache();
  }, [refreshCache, llmStatus]);

  const handleDeleteCached = async (modelId: string) => {
    setDeletingModel(modelId);
    try {
      if (llmModelName === modelId) {
        await unload();
      }
      await clearSpecificModelCache(modelId);
      await refreshCache();
    } catch (err) {
      console.error('Failed to delete cached model:', err);
    } finally {
      setDeletingModel(null);
    }
  };

  const handleClearAll = async () => {
    setDeletingModel('__all__');
    try {
      if (llmModelName) {
        await unload();
      }
      await clearAllModelCaches();
      await refreshCache();
    } catch (err) {
      console.error('Failed to clear all caches:', err);
    } finally {
      setDeletingModel(null);
    }
  };

  const cachedCount = cacheEntries.filter((e) => e.cached).length;
  const lowStorage = storageInfo ? storageInfo.availableBytes < 4 * 1024 * 1024 * 1024 : false;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Select a model to run locally in your browser via WebGPU.
      </p>

      {/* Current model info */}
      {llmModelName && (
        <div className="rounded-lg border border-border bg-surface-raised px-4 py-3">
          <div className="text-xs font-medium text-text-tertiary mb-1">Currently loaded</div>
          <div className="text-sm font-medium text-text-primary">{llmModelName}</div>
          <div className="mt-2 flex gap-4 text-xs text-text-tertiary">
            {tokensPerSecond > 0 && (
              <span className="flex items-center gap-1">
                <Zap size={11} /> {tokensPerSecond.toFixed(1)} tok/s
              </span>
            )}
            {vramUsageMB > 0 && (
              <span className="flex items-center gap-1">
                <HardDrive size={11} />{' '}
                {vramUsageMB >= 1024 ? `${(vramUsageMB / 1024).toFixed(1)} GB` : `${Math.round(vramUsageMB)} MB`}
              </span>
            )}
            <span className="capitalize">{llmStatus}</span>
          </div>
        </div>
      )}

      {/* Model list */}
      <div className="flex flex-col gap-2">
        {RECOMMENDED_MODELS.map((model) => {
          const isActive = llmModelName === model.id;
          const cacheEntry = cacheEntries.find((e) => e.modelId === model.id);
          const isCached = cacheEntry?.cached ?? false;
          return (
            <div
              key={model.id}
              onClick={() => !isLoading && loadModel(model.id)}
              className={`rounded-lg border px-4 py-3 transition-colors ${
                isLoading ? 'cursor-wait opacity-60 pointer-events-none' : 'cursor-pointer'
              } ${
                isActive
                  ? 'border-primary-500/50 bg-primary-500/5'
                  : 'border-border bg-surface-raised hover:bg-surface-overlay'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">{model.name}</span>
                    <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-2xs text-text-tertiary">
                      {model.size}
                    </span>
                    {isActive && !isLoading && <Check size={14} className="text-success-400" />}
                    {isCached && !isActive && (
                      <span className="rounded bg-success-500/10 px-1.5 py-0.5 text-2xs text-success-400">
                        cached{cacheEntry?.cacheSize ? ` (${cacheEntry.cacheSize})` : ''}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-text-tertiary">{model.description}</p>
                </div>
                {!isActive && !isLoading && (
                  <Download size={14} className="shrink-0 text-text-tertiary ml-2" />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Download progress bar shown inline when loading */}
      {isLoading && (
        <div className="rounded-lg border border-info-500/30 bg-info-500/5 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <Loader2 size={14} className="text-info-400 animate-spin" />
            <span className="text-sm font-medium text-text-primary">Downloading model...</span>
            <span className="ml-auto text-xs text-text-tertiary">{percent}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface-overlay">
            <div
              className="h-full rounded-full bg-info-500 transition-all duration-300"
              style={{ width: `${percent}%` }}
            />
          </div>
        </div>
      )}

      <p className="text-2xs text-text-tertiary">
        Models are downloaded once and cached in your browser. WebGPU (Chrome 113+) is required.
      </p>

      {/* ---- Cache Management Section ---- */}
      <div className="border-t border-border pt-4 mt-2">
        <h3 className="text-sm font-medium text-text-primary mb-1">Model Cache</h3>
        <p className="text-xs text-text-secondary mb-3">
          Manage downloaded models stored in your browser cache.
        </p>

        {/* Storage estimate */}
        {storageInfo && (
          <div className={`rounded-lg border px-4 py-2.5 mb-3 ${
            lowStorage
              ? 'border-warning-500/30 bg-warning-500/5'
              : 'border-border bg-surface-raised'
          }`}>
            {lowStorage && (
              <div className="flex items-center gap-1.5 text-xs text-warning-300 mb-1.5">
                <AlertTriangle size={12} />
                Low storage -- clear cached models to free space
              </div>
            )}
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 text-text-secondary">
                <HardDrive size={12} />
                Browser storage
              </span>
              <span className="text-text-tertiary">
                {storageInfo.used} used / {storageInfo.available} free
              </span>
            </div>
            <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-surface-overlay">
              <div
                className={`h-full rounded-full transition-all ${lowStorage ? 'bg-warning-500/60' : 'bg-primary-500/60'}`}
                style={{ width: `${Math.min((storageInfo.usedBytes / storageInfo.quotaBytes) * 100, 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* Cached models list */}
        {cacheLoading ? (
          <div className="flex items-center gap-2 py-3 text-xs text-text-tertiary">
            <Loader2 size={12} className="animate-spin" />
            Checking cache...
          </div>
        ) : cachedCount === 0 ? (
          <p className="py-3 text-xs text-text-tertiary">No models cached.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {cacheEntries
              .filter((e) => e.cached)
              .map((entry) => {
                const isDeleting = deletingModel === entry.modelId;
                const isCurrentlyLoaded = llmModelName === entry.modelId;
                return (
                  <div
                    key={entry.modelId}
                    className="flex items-center justify-between rounded-lg border border-border bg-surface-raised px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-text-primary truncate">{entry.name}</span>
                        <span className="text-2xs text-text-tertiary">
                          {entry.cacheSize || entry.sizeLabel}
                        </span>
                        {isCurrentlyLoaded && (
                          <span className="rounded bg-primary-500/10 px-1.5 py-0.5 text-2xs text-primary-400">
                            loaded
                          </span>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCached(entry.modelId);
                      }}
                      disabled={isDeleting || isLoading}
                      className="flex items-center gap-1 rounded px-2 py-1 text-2xs text-text-tertiary hover:bg-danger-500/10 hover:text-danger-400 transition-colors disabled:opacity-40"
                    >
                      {isDeleting ? (
                        <Loader2 size={11} className="animate-spin" />
                      ) : (
                        <Trash2 size={11} />
                      )}
                      {isDeleting ? 'Removing...' : 'Remove'}
                    </button>
                  </div>
                );
              })}
          </div>
        )}

        {/* Clear all button -- always shown when any models are cached */}
        {cachedCount > 0 && (
          <button
            onClick={handleClearAll}
            disabled={isLoading || deletingModel !== null}
            className="mt-3 w-full flex items-center justify-center gap-2 rounded-lg border border-danger-500/30 bg-danger-500/10 px-4 py-2.5 text-sm font-medium text-danger-400 hover:bg-danger-500/20 transition-colors disabled:opacity-40"
          >
            {deletingModel === '__all__' ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Clear all model data {cachedCount > 1 ? `(${cachedCount} models)` : ''}
          </button>
        )}
      </div>
    </div>
  );
}

