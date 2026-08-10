import { hasModelInCache, deleteModelAllInfoInCache } from '@mlc-ai/web-llm';
import { RECOMMENDED_MODELS } from '../llm/engine';

export interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
  availableBytes: number;
  used: string;
  quota: string;
  available: string;
}

export interface CachedModelInfo {
  modelId: string;
  name: string;
  sizeLabel: string;
  cached: boolean;
  cacheBytes: number | null;
  cacheSize: string;
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
  return `${(bytes / 1024).toFixed(0)} KB`;
}

/** Get current browser storage usage in both raw bytes and human-readable format. */
export async function getStorageUsage(): Promise<StorageUsage | null> {
  if (!navigator.storage?.estimate) return null;
  const est = await navigator.storage.estimate();
  if (est.usage == null || est.quota == null) return null;
  const available = est.quota - est.usage;
  return {
    usedBytes: est.usage,
    quotaBytes: est.quota,
    availableBytes: available,
    used: formatBytes(est.usage),
    quota: formatBytes(est.quota),
    available: formatBytes(available),
  };
}

/** Measure the byte size of a single Cache API cache by name. */
async function getCacheSize(cacheName: string): Promise<number> {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    let total = 0;
    for (const req of keys) {
      const resp = await cache.match(req);
      if (resp) {
        const blob = await resp.blob();
        total += blob.size;
      }
    }
    return total;
  } catch {
    return 0;
  }
}

/** List all web-llm related cache names. */
async function getWebLLMCacheNames(): Promise<string[]> {
  try {
    const allCaches = await caches.keys();
    const webllmCaches = allCaches.filter((name) => name.startsWith('webllm'));
    if (webllmCaches.length > 0 || allCaches.length > 0) {
      console.log('[swarm] All browser caches:', allCaches);
      console.log('[swarm] Web-LLM caches:', webllmCaches);
    }
    return webllmCaches;
  } catch {
    return [];
  }
}

/** Enumerate all recommended models and their cache status/sizes. */
export async function listCachedModels(): Promise<CachedModelInfo[]> {
  const cacheNames = await getWebLLMCacheNames();

  const results = await Promise.all(
    RECOMMENDED_MODELS.map(async (model) => {
      const cached = await hasModelInCache(model.id).catch(() => false);
      console.log(`[swarm] hasModelInCache("${model.id}"): ${cached}`);
      let cacheBytes: number | null = null;

      if (cached) {
        // Try to find matching caches for this model and sum their sizes
        const modelCaches = cacheNames.filter(
          (name) => name.includes(model.id) || name.includes(model.id.replace(/-MLC$/, '')),
        );
        if (modelCaches.length > 0) {
          let total = 0;
          for (const cn of modelCaches) {
            total += await getCacheSize(cn);
          }
          cacheBytes = total;
        }
      }

      return {
        modelId: model.id,
        name: model.name,
        sizeLabel: model.size,
        cached,
        cacheBytes,
        cacheSize: cacheBytes != null ? formatBytes(cacheBytes) : '',
      };
    }),
  );

  return results;
}

/** Get total bytes used by all web-llm caches. */
export async function getTotalCacheSize(): Promise<{ bytes: number; formatted: string }> {
  const cacheNames = await getWebLLMCacheNames();
  let total = 0;
  for (const name of cacheNames) {
    total += await getCacheSize(name);
  }
  return { bytes: total, formatted: formatBytes(total) };
}

/** Delete all web-llm model caches. */
export async function clearAllModelCaches(): Promise<void> {
  // Get ALL caches (not just webllm-prefixed) to catch orphaned entries
  const allCacheNames = await caches.keys();
  const webllmRelated = allCacheNames.filter(
    (name) => name.startsWith('webllm') || name.includes('mlc') || name.includes('MLC'),
  );
  console.log('[swarm] Clearing all webllm-related caches:', webllmRelated);
  await Promise.all(webllmRelated.map((name) => caches.delete(name)));
  // Also use web-llm's API for each known model
  for (const model of RECOMMENDED_MODELS) {
    try {
      await deleteModelAllInfoInCache(model.id);
    } catch {
      // Ignore errors for models not in cache
    }
  }
  // Clear web-llm's IndexedDB entries too
  try {
    const dbs = await indexedDB.databases();
    const webllmDBs = dbs.filter((db) => db.name && (db.name.includes('webllm') || db.name.includes('mlc-')));
    for (const db of webllmDBs) {
      if (db.name) {
        console.log(`[swarm] Deleting IndexedDB: ${db.name}`);
        indexedDB.deleteDatabase(db.name);
      }
    }
  } catch {
    // indexedDB.databases() not available in all browsers
  }
  const remaining = await caches.keys();
  console.log('[swarm] Caches after clear:', remaining);
}

/** Delete a specific model's cache. */
export async function clearSpecificModelCache(modelId: string): Promise<void> {
  console.log(`[swarm] Clearing cache for model: ${modelId}`);
  await deleteModelAllInfoInCache(modelId);
  // Also clean up any related Cache API entries
  try {
    const allCaches = await caches.keys();
    const related = allCaches.filter(
      (name) => name.includes(modelId) || name.includes(modelId.replace(/-MLC$/, '')),
    );
    await Promise.all(related.map((name) => caches.delete(name)));
  } catch {
    // Best effort
  }
}

/** Check if there's enough storage for a model download. Returns available bytes. */
export async function checkStorageForDownload(
  estimatedModelBytes: number,
): Promise<{ hasSpace: boolean; availableBytes: number; needed: number }> {
  const usage = await getStorageUsage();
  if (!usage) return { hasSpace: true, availableBytes: Infinity, needed: 0 };
  const buffer = estimatedModelBytes * 1.5;
  return {
    hasSpace: usage.availableBytes >= buffer,
    availableBytes: usage.availableBytes,
    needed: buffer,
  };
}

// Expose on window for console access
if (typeof window !== 'undefined') {
  (window as unknown as Record<string, unknown>).__swarmStorage = {
    getStorageUsage,
    listCachedModels,
    clearAllModelCaches,
    clearSpecificModelCache,
    getTotalCacheSize,
  };
}
