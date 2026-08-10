import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../store/app-store';
import { MLC_AUTO_MODELS, OLLAMA_AUTO_MODELS, MLC_EXPERT_MODELS, DEFAULT_MODEL } from '../../llm/engine';
import { useLLM } from '../../hooks/useLLM';
import { getProviderConfig, setProviderConfig, resetProvider } from '../../llm/provider-singleton';
import { HardDrive, Zap, Check, Loader2, Download, Trash2, AlertTriangle, Wifi, Cpu } from 'lucide-react';
import {
  listCachedModels,
  getStorageUsage,
  clearSpecificModelCache,
  clearAllModelCaches,
  type CachedModelInfo,
  type StorageUsage,
} from '../../utils/storage-cleanup';
import type { ProviderType } from '../../llm/provider-singleton';

export function ModelConfig() {
  const llmModelName = useAppStore((s) => s.llmModelName);
  const llmStatus = useAppStore((s) => s.llmStatus);
  const llmProgress = useAppStore((s) => s.llmProgress);
  const vramUsageMB = useAppStore((s) => s.vramUsageMB);
  const tokensPerSecond = useAppStore((s) => s.tokensPerSecond);
  const { loadModel, unload } = useLLM();

  const isLoading = llmStatus === 'loading';
  const percent = Math.round(llmProgress * 100);

  // Provider selection
  const config = getProviderConfig();
  const [provider, setProviderState] = useState<ProviderType>(config.provider);
  const [ollamaEndpoint, setOllamaEndpoint] = useState(config.ollamaEndpoint || 'http://localhost:11434');


  // Cache management state
  const [cacheEntries, setCacheEntries] = useState<CachedModelInfo[]>([]);
  const [cacheLoading, setCacheLoading] = useState(true);
  const [deletingModel, setDeletingModel] = useState<string | null>(null);
  const [storageInfo, setStorageInfo] = useState<StorageUsage | null>(null);

  const isDemo = llmModelName === 'demo/demo-mode';

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

  const handleProviderChange = (newProvider: ProviderType) => {
    setProviderState(newProvider);
    setProviderConfig({ provider: newProvider });
    resetProvider();

    // Auto-load the default model for this provider
    if (newProvider === 'ollama') {
      const ollamaDefault = OLLAMA_AUTO_MODELS[0]?.id || 'ollama/smollm2:135m';
      loadModel(ollamaDefault);
    } else if (newProvider === 'webllm') {
      loadModel(DEFAULT_MODEL);
    }
  };

  const handleModelSelect = (modelId: string) => {
    if (isLoading) return;
    setProviderConfig({ modelId });
    loadModel(modelId);
  };

  const handleOllamaEndpointSave = () => {
    setProviderConfig({ ollamaEndpoint });
    if (provider === 'ollama') {
      resetProvider();
      const ollamaDefault = OLLAMA_AUTO_MODELS[0]?.id || 'ollama/smollm2:135m';
      loadModel(ollamaDefault);
    }
  };

  const cachedCount = cacheEntries.filter((e) => e.cached).length;
  const lowStorage = storageInfo ? storageInfo.availableBytes < 4 * 1024 * 1024 * 1024 : false;

  return (
    <div className="flex flex-col gap-4">
      {/* ---- Provider Selector ---- */}
      <div>
        <h3 className="text-sm font-medium text-text-primary mb-2">Inference Provider</h3>
        <p className="text-xs text-text-secondary mb-3">
          Choose how AI inference runs. WebLLM is the zero-setup default (no API key, no install).
          Ollama requires a local Ollama service.
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => handleProviderChange('webllm')}
            className={`flex-1 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              provider === 'webllm'
                ? 'border-primary-500/50 bg-primary-500/10 text-primary-300'
                : 'border-border bg-surface-raised text-text-secondary hover:bg-surface-overlay'
            }`}
          >
            <Cpu size={16} />
            <div className="text-left">
              <div className="font-medium">WebLLM</div>
              <div className="text-2xs text-text-tertiary">Default — browser AI, zero setup</div>
            </div>
            {provider === 'webllm' && <Check size={14} className="ml-auto text-primary-400" />}
          </button>
          <button
            onClick={() => handleProviderChange('ollama')}
            className={`flex-1 flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
              provider === 'ollama'
                ? 'border-primary-500/50 bg-primary-500/10 text-primary-300'
                : 'border-border bg-surface-raised text-text-secondary hover:bg-surface-overlay'
            }`}
          >
            <Wifi size={16} />
            <div className="text-left">
              <div className="font-medium">Ollama</div>
              <div className="text-2xs text-text-tertiary">Expert — local service required</div>
            </div>
            {provider === 'ollama' && <Check size={14} className="ml-auto text-primary-400" />}
          </button>
        </div>
      </div>

      {/* ---- Demo Mode indicator ---- */}
      {isDemo && (
        <div className="rounded-lg border border-warning-500/30 bg-warning-500/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="shrink-0 text-warning-400" />
            <span className="text-sm font-medium text-warning-300">Demo Mode</span>
          </div>
          <p className="mt-1 text-xs text-warning-200/70">
            No AI model is loaded. Responses are static templates. 
            Select a provider and model above to enable AI inference.
          </p>
        </div>
      )}

      {/* ---- Current model info ---- */}
      {llmModelName && llmModelName !== 'demo/demo-mode' && (
        <div className="rounded-lg border border-border bg-surface-raised px-4 py-3">
          <div className="text-xs font-medium text-text-tertiary mb-1">Currently loaded</div>
          <div className="text-sm font-medium text-text-primary">{llmModelName}</div>
          <div className="mt-2 flex gap-4 text-xs text-text-tertiary">
            <span className="capitalize flex items-center gap-1">
              <span className={`h-1.5 w-1.5 rounded-full ${
                llmStatus === 'ready' ? 'bg-success-400' : llmStatus === 'generating' ? 'bg-warning-400' : 'bg-text-tertiary'
              }`} />
              {llmStatus}
            </span>
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
          </div>
        </div>
      )}

      {/* ---- WebLLM Models Section ---- */}
      {provider === 'webllm' && (
        <>
          <div>
            <h3 className="text-sm font-medium text-text-primary mb-2">WebLLM Models</h3>
            <p className="text-xs text-text-secondary mb-3">
              Browser-based inference via WebGPU. No setup, no API key. Download once, cached automatically.
            </p>
          </div>

          {/* Auto models (default) */}
          {MLC_AUTO_MODELS.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-text-tertiary">Default (zero-setup)</p>
              {MLC_AUTO_MODELS.map((model) => {
                const isActive = llmModelName === model.id;
                const cacheEntry = cacheEntries.find((e) => e.modelId === model.id);
                const isCached = cacheEntry?.cached ?? false;
                return (
                  <ModelCard
                    key={model.id}
                    model={model}
                    isActive={isActive}
                    isLoading={isLoading}
                    isCached={isCached}
                    cacheEntry={cacheEntry}
                    onSelect={() => handleModelSelect(model.id)}
                  />
                );
              })}
            </div>
          )}

          {/* Expert models (>1.5B) */}
          {MLC_EXPERT_MODELS.length > 0 && (
            <div className="flex flex-col gap-2 mt-2">
              <p className="text-xs font-medium text-text-tertiary">Expert (larger models, download may be slow)</p>
              {MLC_EXPERT_MODELS.map((model) => {
                const isActive = llmModelName === model.id;
                const cacheEntry = cacheEntries.find((e) => e.modelId === model.id);
                const isCached = cacheEntry?.cached ?? false;
                return (
                  <ModelCard
                    key={model.id}
                    model={model}
                    isActive={isActive}
                    isLoading={isLoading}
                    isCached={isCached}
                    cacheEntry={cacheEntry}
                    onSelect={() => handleModelSelect(model.id)}
                  />
                );
              })}
            </div>
          )}

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
        </>
      )}

      {/* ---- Ollama Section ---- */}
      {provider === 'ollama' && (
        <>
          {/* Ollama endpoint */}
          <div className="rounded-lg border border-border bg-surface-raised px-4 py-3">
            <h3 className="text-sm font-medium text-text-primary mb-2">Ollama Connection</h3>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={ollamaEndpoint}
                onChange={(e) => setOllamaEndpoint(e.target.value)}
                placeholder="http://localhost:11434"
                className="flex-1 rounded-lg border border-border bg-surface-inset px-3 py-1.5 text-xs text-text-primary outline-none focus:border-primary-500/50"
              />
              <button
                onClick={handleOllamaEndpointSave}
                className="rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-500 transition-colors"
              >
                Update
              </button>
            </div>
            <p className="mt-2 text-2xs text-text-tertiary">
              Default: http://localhost:11434. Change if Ollama is running on a different host.
            </p>
          </div>

          {/* Ollama setup help */}
          <div className="rounded-lg border border-primary-500/20 bg-primary-500/5 px-4 py-3">
            <h3 className="text-xs font-medium text-primary-300 mb-2">Ollama Setup</h3>
            <ol className="ml-4 list-decimal space-y-1 text-2xs text-text-secondary">
              <li>Install Ollama: <code className="rounded bg-surface-overlay px-1">brew install ollama</code></li>
              <li>Start Ollama: <code className="rounded bg-surface-overlay px-1">ollama serve</code></li>
              <li>Pull a model: <code className="rounded bg-surface-overlay px-1">ollama pull smollm2:135m</code></li>
              <li>Verify: <code className="rounded bg-surface-overlay px-1">curl http://localhost:11434/api/tags</code></li>
            </ol>
          </div>

          {/* Ollama models */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-medium text-text-tertiary">Ollama Models</p>
            {OLLAMA_AUTO_MODELS.map((model) => {
              const isActive = llmModelName === model.id;
              return (
                <ModelCard
                  key={model.id}
                  model={model}
                  isActive={isActive}
                  isLoading={isLoading}
                  isCached={false}
                  cacheEntry={undefined}
                  onSelect={() => handleModelSelect(model.id)}
                />
              );
            })}
          </div>
        </>
      )}

      {/* ---- Cache Management Section (WebLLM only) ---- */}
      {provider === 'webllm' && (
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

          {/* Clear all button */}
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
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ModelCard sub-component
// ---------------------------------------------------------------------------

interface ModelItem {
  id: string;
  name: string;
  size: string;
  runtime: string;
  description: string;
}

function ModelCard({
  model,
  isActive,
  isLoading,
  isCached,
  cacheEntry,
  onSelect,
}: {
  model: ModelItem;
  isActive: boolean;
  isLoading: boolean;
  isCached: boolean;
  cacheEntry: CachedModelInfo | undefined;
  onSelect: () => void;
}) {
  return (
    <div
      onClick={onSelect}
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
            <span className="rounded bg-surface-overlay px-1.5 py-0.5 text-2xs text-text-tertiary">
              {model.runtime}
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
        {!isActive && !isLoading && model.runtime === 'WebLLM' && (
          <Download size={14} className="shrink-0 text-text-tertiary ml-2" />
        )}
      </div>
    </div>
  );
}
