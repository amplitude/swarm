import { useAppStore } from '../../store/app-store';
import { PanelLeft, PanelRight } from 'lucide-react';

interface PanelToggleProps {
  side: 'left' | 'right';
}

export function PanelToggle({ side }: PanelToggleProps) {
  const toggleSidebar = useAppStore((s) => s.toggleSidebar);
  const toggleRightPanel = useAppStore((s) => s.toggleRightPanel);

  const onClick = side === 'left' ? toggleSidebar : toggleRightPanel;
  const Icon = side === 'left' ? PanelLeft : PanelRight;
  const title = side === 'left' ? 'Open sidebar' : 'Open panel';

  return (
    <button
      onClick={onClick}
      className="flex h-8 w-6 items-center justify-center border-border text-text-tertiary hover:text-text-secondary hover:bg-surface-raised transition-colors"
      title={title}
    >
      <Icon size={14} />
    </button>
  );
}
