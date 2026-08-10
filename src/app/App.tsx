import { useEffect, useRef, useState } from 'react';
import { useAppStore, switchAgent } from '../store/app-store';
import { AppLayout } from '../components/layout/AppLayout';
import { Header } from '../components/layout/Header';
import { ChatPanel } from '../components/chat/ChatPanel';
import { SettingsPanel } from '../components/settings/SettingsPanel';
import { MissionControl } from '../components/dashboard/MissionControl';
import { ArtifactPanel } from '../components/canvas/ArtifactPanel';
import { ModelLoadingOverlay } from '../components/onboarding/ModelLoadingOverlay';
import { useLLM } from '../hooks/useLLM';
import { checkWebGPUSupport, DEFAULT_MODEL } from '../llm/engine';
import { checkStorageForDownload } from '../utils/storage-cleanup';
import { getProviderConfig } from '../llm/provider-singleton';
import { getModelEstimatedBytes } from '../llm/model-capabilities';
import type { AgentType } from '../types/agent';
import { AlertTriangle } from 'lucide-react';

const AGENT_KEYS: AgentType[] = ['manager', 'general', 'coder', 'pm', 'designer'];

export function App() {
  const theme = useAppStore((s) => s.theme);
  const viewMode = useAppStore((s) => s.viewMode);
  const llmStatus = useAppStore((s) => s.llmStatus);
  const llmProgress = useAppStore((s) => s.llmProgress);
  const llmError = useAppStore((s) => s.llmError);
  const [webGPUError, setWebGPUError] = useState<string | null>(null);
  const { loadModel, unload } = useLLM();
  const autoLoadAttempted = useRef(false);
  const [autoLoadSkipped, setAutoLoadSkipped] = useState(false);

  // Apply theme class on mount
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // Check WebGPU support on mount (only needed for WebLLM provider)
  useEffect(() => {
    const config = getProviderConfig();
    if (config.provider === 'webllm') {
      checkWebGPUSupport().then((result) => {
        if (!result.supported) {
          setWebGPUError(result.error ?? 'WebGPU is not supported in this browser.');
        }
      });
    }
  }, []);

  // Auto-load last model on mount
  useEffect(() => {
    if (autoLoadAttempted.current) return;
    if (llmStatus !== 'idle') return;

    const config = getProviderConfig();
    const lastModel = localStorage.getItem('swarm-last-model');
    const modelToLoad = lastModel || config.modelId;

    autoLoadAttempted.current = true;

    if (modelToLoad.startsWith('ollama/')) {
      // Ollama models don't need download — just try connecting
      console.log(`[swarm] Auto-loading Ollama model "${modelToLoad}"`);
      loadModel(modelToLoad);
    } else {
      // WebLLM model — check cache first
      import('@mlc-ai/web-llm')
        .then(({ hasModelInCache }) => hasModelInCache(modelToLoad))
        .catch(() => false)
        .then(async (cached) => {
          if (cached) {
            console.log(`[swarm] Model "${modelToLoad}" found in cache, loading directly`);
            loadModel(modelToLoad);
            return;
          }
          // Model not cached — check storage before downloading
          const estimatedBytes = getModelEstimatedBytes(modelToLoad);
          const check = await checkStorageForDownload(estimatedBytes);
          if (check.hasSpace || estimatedBytes === 0) {
            console.log(`[swarm] Model "${modelToLoad}" not cached but space available, downloading`);
            loadModel(modelToLoad);
          } else {
            console.warn(
              `[swarm] Skipping auto-load: model not cached and only ${(check.availableBytes / (1024 * 1024 * 1024)).toFixed(1)} GB available`,
            );
            setAutoLoadSkipped(true);
          }
        });
    }
  }, [llmStatus, loadModel]);

  const needsSetup = llmStatus === 'idle' && !localStorage.getItem('swarm-model-dismissed') && (!localStorage.getItem('swarm-last-model') || autoLoadSkipped);

  // Keyboard shortcuts: Cmd+1..5 for agent switching
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key >= '1' && e.key <= '5') {
        e.preventDefault();
        const idx = parseInt(e.key, 10) - 1;
        const agent = AGENT_KEYS[idx];
        if (agent) {
          switchAgent(agent);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleStartDownload = () => {
    autoLoadAttempted.current = true;
    loadModel(DEFAULT_MODEL);
  };

  const handleCancel = () => {
    void unload();
    localStorage.setItem('swarm-model-dismissed', 'true');
  };

  const handleRetry = () => {
    const modelId = localStorage.getItem('swarm-last-model') || DEFAULT_MODEL;
    localStorage.removeItem('swarm-model-dismissed');
    loadModel(modelId);
  };

  return (
    <>
      {/* Setup / download overlay -- component self-manages visibility */}
      <ModelLoadingOverlay
        status={llmStatus}
        progress={llmProgress}
        error={llmError}
        isFirstRun={needsSetup}
        onStart={handleStartDownload}
        onCancel={handleCancel}
        onRetry={handleRetry}
      />

      {viewMode === 'dashboard' ? (
        <>
          {webGPUError && <WebGPUBanner message={webGPUError} onDismiss={() => setWebGPUError(null)} />}
          <MissionControl />
        </>
      ) : (
        <AppLayout
          main={
            <>
              <Header />
              {webGPUError && <WebGPUBanner message={webGPUError} onDismiss={() => setWebGPUError(null)} />}
              <ChatPanel />
            </>
          }
          rightPanel={<ArtifactPanel />}
        />
      )}
      <SettingsPanel />
    </>
  );
}

function WebGPUBanner({ message, onDismiss }: { message: string; onDismiss: () => void }) {
  return (
    <div className="flex items-center gap-3 border-b border-warning-500/20 bg-warning-500/10 px-4 py-2.5">
      <AlertTriangle size={16} className="shrink-0 text-warning-400" />
      <p className="flex-1 text-sm text-warning-300">{message}</p>
      <button
        onClick={onDismiss}
        className="shrink-0 rounded px-2 py-0.5 text-xs text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
      >
        Dismiss
      </button>
    </div>
  );
}
