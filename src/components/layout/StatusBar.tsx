import { useAppStore } from '../../store/app-store';
import { Cpu, Zap, HardDrive } from 'lucide-react';

export function StatusBar() {
  const llmStatus = useAppStore((s) => s.llmStatus);
  const llmModelName = useAppStore((s) => s.llmModelName);
  const tokensPerSecond = useAppStore((s) => s.tokensPerSecond);
  const vramUsageMB = useAppStore((s) => s.vramUsageMB);
  const llmProgress = useAppStore((s) => s.llmProgress);

  const statusColor =
    llmStatus === 'ready'
      ? 'bg-success-400'
      : llmStatus === 'generating'
        ? 'bg-warning-400 animate-pulse-dot'
        : llmStatus === 'loading'
          ? 'bg-info-400 animate-pulse-dot'
          : llmStatus === 'error'
            ? 'bg-danger-400'
            : 'bg-text-tertiary';

  return (
    <div className="flex h-7 items-center gap-4 border-t border-border bg-surface px-4 text-2xs text-text-tertiary">
      {/* Status dot + model name */}
      <div className="flex items-center gap-1.5">
        <span className={`h-1.5 w-1.5 rounded-full ${statusColor}`} />
        <Cpu size={11} />
        <span>{llmModelName || 'No model loaded'}</span>
        {llmStatus === 'loading' && (
          <span className="text-info-400">({Math.round(llmProgress * 100)}%)</span>
        )}
      </div>

      <div className="flex-1" />

      {/* Tokens/sec */}
      {llmStatus === 'ready' || llmStatus === 'generating' ? (
        <div className="flex items-center gap-1">
          <Zap size={11} />
          <span>{tokensPerSecond.toFixed(1)} tok/s</span>
        </div>
      ) : null}

      {/* VRAM */}
      {vramUsageMB > 0 && (
        <div className="flex items-center gap-1">
          <HardDrive size={11} />
          <span>{vramUsageMB >= 1024 ? `${(vramUsageMB / 1024).toFixed(1)} GB` : `${Math.round(vramUsageMB)} MB`}</span>
        </div>
      )}
    </div>
  );
}
