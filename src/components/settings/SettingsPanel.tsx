import { useAppStore } from '../../store/app-store';
import { X } from 'lucide-react';
import { useState } from 'react';
import { AgentConfig } from './AgentConfig';
import { ModelConfig } from './ModelConfig';
import { AppearanceConfig } from './AppearanceConfig';
import { DataConfig } from './DataConfig';

type SettingsTab = 'agents' | 'model' | 'appearance' | 'data';

const TABS: { id: SettingsTab; label: string }[] = [
  { id: 'agents', label: 'Agents' },
  { id: 'model', label: 'Model' },
  { id: 'appearance', label: 'Appearance' },
  { id: 'data', label: 'Data' },
];

export function SettingsPanel() {
  const settingsOpen = useAppStore((s) => s.settingsOpen);
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen);
  const [activeTab, setActiveTab] = useState<SettingsTab>('agents');

  if (!settingsOpen) return null;

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="relative flex h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-surface shadow-xl animate-scale-in">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3">
          <h2 className="text-base font-semibold text-text-primary">Settings</h2>
          <button
            onClick={() => setSettingsOpen(false)}
            className="rounded-md p-1.5 text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex gap-0 border-b border-border px-5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative px-3 py-2.5 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-text-primary'
                  : 'text-text-tertiary hover:text-text-secondary'
              }`}
            >
              {tab.label}
              {activeTab === tab.id && (
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary-500 rounded-full" />
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5">
          {activeTab === 'agents' && <AgentConfig />}
          {activeTab === 'model' && <ModelConfig />}
          {activeTab === 'appearance' && <AppearanceConfig />}
          {activeTab === 'data' && <DataConfig />}
        </div>
      </div>
    </div>
  );
}
