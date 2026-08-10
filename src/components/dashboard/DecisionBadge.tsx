import { useAppStore } from '../../store/app-store';
import { AlertCircle } from 'lucide-react';

export function DecisionBadge() {
  const pendingCount = useAppStore(
    (s) => s.decisions.filter((d) => d.status === 'pending').length,
  );
  const setViewMode = useAppStore((s) => s.setViewMode);

  if (pendingCount === 0) return null;

  return (
    <button
      onClick={() => setViewMode('chat')}
      className="flex items-center gap-1.5 rounded-full bg-warning-500/15 px-2.5 py-1 text-xs font-medium text-warning-400 hover:bg-warning-500/25 transition-colors"
      title="Switch to chat to review pending decisions"
    >
      <AlertCircle size={12} />
      {pendingCount} pending {pendingCount === 1 ? 'decision' : 'decisions'}
    </button>
  );
}
