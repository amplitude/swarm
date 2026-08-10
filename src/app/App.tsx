import { useEffect } from 'react';
import { useAppStore, switchAgent } from '../store/app-store';
import { AppLayout } from '../components/layout/AppLayout';
import { Header } from '../components/layout/Header';
import { ChatPanel } from '../components/chat/ChatPanel';
import { SettingsPanel } from '../components/settings/SettingsPanel';
import { MissionControl } from '../components/dashboard/MissionControl';
import { ArtifactPanel } from '../components/canvas/ArtifactPanel';
import { ModelStatus } from '../components/onboarding/ModelStatus';
import type { AgentType } from '../types/agent';

const AGENT_KEYS: AgentType[] = ['manager', 'general', 'coder', 'pm', 'designer'];

export function App() {
  const theme = useAppStore((s) => s.theme);
  const viewMode = useAppStore((s) => s.viewMode);

  // Apply theme class on mount
  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

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

  return (
    <>
      {/* Nonblocking model status bar — shows download progress, error, or demo mode.
          Never obscures the app. Replaces the old full-screen ModelLoadingOverlay. */}
      <ModelStatus />

      {viewMode === 'dashboard' ? (
        <MissionControl />
      ) : (
        <AppLayout
          main={
            <>
              <Header />
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
