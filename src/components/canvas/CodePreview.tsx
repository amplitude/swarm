import { useEffect, useRef, useState } from 'react';
import { IframeSandbox } from '@/sandbox/iframe-sandbox';
import type { ConsoleEntry, SandboxResult } from '@/sandbox/types';
import { Play, RotateCcw, Terminal } from 'lucide-react';

interface CodePreviewProps {
  code: string;
  mode?: 'js' | 'html';
  autoRun?: boolean;
}

export function CodePreview({ code, mode = 'html', autoRun = false }: CodePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const sandboxRef = useRef<IframeSandbox | null>(null);
  const [result, setResult] = useState<SandboxResult | null>(null);
  const [showConsole, setShowConsole] = useState(false);

  useEffect(() => {
    const sandbox = new IframeSandbox();
    sandboxRef.current = sandbox;
    return () => sandbox.dispose();
  }, []);

  useEffect(() => {
    if (autoRun && code) {
      runCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, autoRun]);

  const runCode = async () => {
    const sandbox = sandboxRef.current;
    if (!sandbox || !containerRef.current) return;

    const iframeContainer = containerRef.current.querySelector('.iframe-host');
    if (!iframeContainer) return;

    iframeContainer.innerHTML = '';
    sandbox.create(iframeContainer as HTMLElement);
    const res = await sandbox.execute(code, { mode });
    setResult(res);
    if (res.logs.length > 0) {
      setShowConsole(true);
    }
  };

  const logs = result?.logs ?? [];

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 border-b border-border bg-surface px-2 py-1.5">
        <button
          onClick={runCode}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
        >
          <Play size={12} />
          Run
        </button>
        <button
          onClick={() => {
            setResult(null);
            setShowConsole(false);
          }}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
        >
          <RotateCcw size={12} />
          Clear
        </button>
        <div className="flex-1" />
        <button
          onClick={() => setShowConsole((v) => !v)}
          className={`flex items-center gap-1.5 rounded-md px-2 py-1 text-xs transition-colors ${
            showConsole
              ? 'bg-surface-overlay text-text-primary'
              : 'text-text-tertiary hover:bg-surface-raised hover:text-text-secondary'
          }`}
        >
          <Terminal size={12} />
          Console
          {logs.length > 0 && (
            <span className="rounded-full bg-primary-600/20 px-1.5 text-2xs text-primary-400">
              {logs.length}
            </span>
          )}
        </button>
      </div>

      {/* Preview area */}
      <div className="flex-1 overflow-hidden bg-white relative">
        <div ref={containerRef} className="h-full">
          <div className="iframe-host h-full w-full" />
        </div>
        {!result && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface-inset">
            <p className="text-sm text-text-tertiary">Click Run to execute</p>
          </div>
        )}
      </div>

      {/* Console panel */}
      {showConsole && (
        <div className="border-t border-border bg-surface-inset max-h-40 overflow-y-auto">
          {logs.length === 0 ? (
            <p className="px-3 py-2 text-xs text-text-tertiary">No console output</p>
          ) : (
            <div className="divide-y divide-border-subtle">
              {logs.map((entry, i) => (
                <ConsoleRow key={i} entry={entry} />
              ))}
            </div>
          )}
          {result && !result.success && result.error && (
            <div className="border-t border-danger-500/20 bg-danger-500/5 px-3 py-1.5 text-xs text-danger-400">
              {result.error}
            </div>
          )}
          {result && result.value !== undefined && (
            <div className="border-t border-border-subtle px-3 py-1.5 text-xs text-text-secondary">
              <span className="text-text-tertiary">Return: </span>
              {result.value}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ConsoleRow({ entry }: { entry: ConsoleEntry }) {
  const levelColors: Record<string, string> = {
    log: 'text-text-secondary',
    info: 'text-primary-400',
    warn: 'text-warning-400',
    error: 'text-danger-400',
  };

  return (
    <div className={`px-3 py-1 text-xs font-mono ${levelColors[entry.level] ?? 'text-text-secondary'}`}>
      {entry.args.join(' ')}
    </div>
  );
}
