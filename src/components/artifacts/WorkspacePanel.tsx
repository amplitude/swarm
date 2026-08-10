import { useState, useEffect, useMemo } from 'react';
import { Package } from 'lucide-react';
import type { AgentType } from '../../types/agent';
import type { Artifact, ArtifactType } from '../../types/tool';
import { artifactRepo } from '../../db/repositories/artifacts';
import { useAppStore } from '../../store/app-store';
import { ArtifactCard } from './ArtifactCard';

const AGENT_FILTERS: { value: AgentType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Agents' },
  { value: 'manager', label: 'Manager' },
  { value: 'coder', label: 'Coder' },
  { value: 'pm', label: 'PM' },
  { value: 'designer', label: 'Designer' },
  { value: 'general', label: 'General' },
];

const TYPE_FILTERS: { value: ArtifactType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'code', label: 'Code' },
  { value: 'diagram-mermaid', label: 'Mermaid' },
  { value: 'diagram-excalidraw', label: 'Excalidraw' },
  { value: 'document', label: 'Document' },
  { value: 'image', label: 'Image' },
];

export function WorkspacePanel() {
  const [artifacts, setArtifacts] = useState<Artifact[]>([]);
  const [agentFilter, setAgentFilter] = useState<AgentType | 'all'>('all');
  const [typeFilter, setTypeFilter] = useState<ArtifactType | 'all'>('all');
  const openArtifact = useAppStore((s) => s.openArtifact);

  useEffect(() => {
    artifactRepo.getAll().then(setArtifacts).catch(console.error);
  }, []);

  const filtered = useMemo(() => {
    return artifacts.filter((a) => {
      if (agentFilter !== 'all' && a.creatorAgent !== agentFilter) return false;
      if (typeFilter !== 'all' && a.type !== typeFilter) return false;
      return true;
    });
  }, [artifacts, agentFilter, typeFilter]);

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-text-primary">
          <Package size={14} />
          Artifacts ({filtered.length})
        </h3>
        <div className="flex items-center gap-2">
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value as AgentType | 'all')}
            className="text-2xs bg-surface border border-border-subtle rounded px-1.5 py-1 text-text-secondary"
          >
            {AGENT_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as ArtifactType | 'all')}
            className="text-2xs bg-surface border border-border-subtle rounded px-1.5 py-1 text-text-secondary"
          >
            {TYPE_FILTERS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-xs text-text-tertiary py-4 text-center">No artifacts yet</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          {filtered.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              onClick={openArtifact}
            />
          ))}
        </div>
      )}
    </div>
  );
}
