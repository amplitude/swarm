import { useAppStore } from '../../store/app-store';
import { X, FileCode, GitBranch, PenTool, Briefcase, Code2, ClipboardList, Palette, Bot } from 'lucide-react';
import { lazy, Suspense } from 'react';
import { MermaidDiagram } from './MermaidDiagram';
import { CodePreview } from './CodePreview';
import { CodeEditor } from './CodeEditor';
import type { AgentType } from '../../types/agent';

const AGENT_BADGE: Record<AgentType, { label: string; icon: typeof Bot; className: string }> = {
  manager: { label: 'Manager', icon: Briefcase, className: 'bg-primary-400/15 text-primary-400' },
  coder: { label: 'Coder', icon: Code2, className: 'bg-agent-coder/15 text-agent-coder' },
  pm: { label: 'PM', icon: ClipboardList, className: 'bg-agent-pm/15 text-agent-pm' },
  designer: { label: 'Designer', icon: Palette, className: 'bg-agent-designer/15 text-agent-designer' },
  general: { label: 'General', icon: Bot, className: 'bg-agent-general/15 text-agent-general' },
};

const ExcalidrawCanvas = lazy(() =>
  import('./ExcalidrawCanvas').then((m) => ({ default: m.ExcalidrawCanvas })),
);

export function ArtifactPanel() {
  const artifact = useAppStore((s) => s.selectedArtifact);
  const closeArtifact = useAppStore((s) => s.closeArtifact);

  if (!artifact) {
    return (
      <div className="flex flex-1 items-center justify-center p-4">
        <p className="text-sm text-text-tertiary">No artifact selected</p>
      </div>
    );
  }

  const icon =
    artifact.type === 'diagram-mermaid' ? (
      <GitBranch size={14} />
    ) : artifact.type === 'diagram-excalidraw' ? (
      <PenTool size={14} />
    ) : (
      <FileCode size={14} />
    );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-2">
        <span className="text-text-tertiary">{icon}</span>
        <span className="flex-1 truncate text-sm font-medium text-text-primary">
          {artifact.name}
        </span>
        {artifact.creatorAgent && (() => {
          const badge = AGENT_BADGE[artifact.creatorAgent];
          const BadgeIcon = badge.icon;
          return (
            <span className={`inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded-full ${badge.className}`}>
              <BadgeIcon size={10} />
              {badge.label}
            </span>
          );
        })()}
        <button
          onClick={closeArtifact}
          className="rounded-md p-1 text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {artifact.type === 'diagram-mermaid' && (
          <MermaidDiagram definition={artifact.content} expanded className="h-full p-4" />
        )}
        {artifact.type === 'diagram-excalidraw' && (
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
                Loading Excalidraw...
              </div>
            }
          >
            <ExcalidrawCanvas
              elements={JSON.parse(artifact.content)}
              expanded
              className="h-full"
            />
          </Suspense>
        )}
        {artifact.type === 'code' && artifact.language === 'html' && (
          <CodePreview code={artifact.content} mode="html" autoRun />
        )}
        {artifact.type === 'code' && artifact.language !== 'html' && (
          <CodeEditor
            value={artifact.content}
            language={artifact.language}
            readOnly
          />
        )}
        {artifact.type === 'document' && (
          <div className="overflow-y-auto p-4 text-sm text-text-primary whitespace-pre-wrap">
            {artifact.content}
          </div>
        )}
      </div>
    </div>
  );
}
