import { useAppStore } from '../../store/app-store';
import { Sun, Moon } from 'lucide-react';

export function AppearanceConfig() {
  const theme = useAppStore((s) => s.theme);
  const setTheme = useAppStore((s) => s.setTheme);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">Customize the look and feel of Swarm.</p>

      {/* Theme selector */}
      <div>
        <label className="text-xs font-medium text-text-secondary">Theme</label>
        <div className="mt-2 flex gap-2">
          <ThemeOption
            icon={<Moon size={16} />}
            label="Dark"
            active={theme === 'dark'}
            onClick={() => setTheme('dark')}
          />
          <ThemeOption
            icon={<Sun size={16} />}
            label="Light"
            active={theme === 'light'}
            onClick={() => setTheme('light')}
          />
        </div>
      </div>

      {/* Font size */}
      <div>
        <label className="text-xs font-medium text-text-secondary">Font Size</label>
        <p className="mt-1 text-xs text-text-tertiary">
          Base font size is 14px. Adjust browser zoom to change.
        </p>
      </div>
    </div>
  );
}

function ThemeOption({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${
        active
          ? 'border-primary-500/50 bg-primary-500/10 text-text-primary'
          : 'border-border bg-surface-raised text-text-secondary hover:bg-surface-overlay'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}
