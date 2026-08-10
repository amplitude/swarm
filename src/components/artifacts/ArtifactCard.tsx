import type { Artifact } from '../../types/tool';
import type { AgentType } from '../../types/agent';
import { FileCode, GitBranch, PenTool, FileText, Image, Briefcase, Code2, ClipboardList, Palette, Bot } from 'lucide-react';

const AGENT_META: Record<AgentType, { label: string; bgColor: string; textColor: string }> = {
  manager: { label: 'Manager', bgColor: 'bg-primary-400/15', textColor: 'text-primary-400' },
  coder: { label: 'Coder', bgColor: 'bg-agent-coder/15', textColor: 'text-agent-coder' },
  pm: { label: 'PM', bgColor: 'bg-agent-pm/15', textColor: 'text-agent-pm' },
  designer: { label: 'Designer', bgColor: 'bg-agent-designer/15', textColor: 'text-agent-designer' },
  general: { label: 'General', bgColor: 'bg-agent-general/15', textColor: 'text-agent-general' },
};

const AGENT_ICONS: Record<AgentType, typeof Bot> = {
  manager: Briefcase,
  coder: Code2,
  pm: ClipboardList,
  designer: Palette,
  general: Bot,
};

const TYPE_ICONS: Record<Artifact['type'], typeof FileCode> = {
  'code': FileCode,
  'diagram-mermaid': GitBranch,
  'diagram-excalidraw': PenTool,
  'document': FileText,
  'image': Image,
};

interface ArtifactCardProps {
  artifact: Artifact;
  onClick?: (artifact: Artifact) => void;
}

export function ArtifactCard({ artifact, onClick }: ArtifactCardProps) {
  const TypeIcon = TYPE_ICONS[artifact.type] ?? FileCode;
  const agentMeta = AGENT_META[artifact.creatorAgent];
  const AgentIcon = AGENT_ICONS[artifact.creatorAgent];

  const timeStr = new Date(artifact.createdAt).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      onClick={() => onClick?.(artifact)}
      className="bg-surface-raised border border-border-subtle rounded-lg p-3 transition-all duration-150 hover:border-border-strong cursor-pointer group"
    >
      {/* Top row: type icon + name */}
      <div className="flex items-start gap-2 mb-2">
        <span className="mt-0.5 text-text-tertiary">
          <TypeIcon size={14} />
        </span>
        <span className="flex-1 text-sm font-medium text-text-primary truncate">
          {artifact.name}
        </span>
      </div>

      {/* Preview: first line of content */}
      <p className="text-2xs text-text-tertiary line-clamp-2 mb-3 font-mono">
        {artifact.content.slice(0, 120)}
      </p>

      {/* Footer: agent badge + timestamp */}
      <div className="flex items-center justify-between">
        <span className={`inline-flex items-center gap-1 text-2xs px-1.5 py-0.5 rounded-full ${agentMeta.bgColor} ${agentMeta.textColor}`}>
          <AgentIcon size={10} />
          {agentMeta.label}
        </span>
        <span className="text-2xs text-text-tertiary">{timeStr}</span>
      </div>
    </div>
  );
}
