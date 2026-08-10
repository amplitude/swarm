import type { Decision, DecisionOption } from '../../types/decision';
import type { AgentType } from '../../types/agent';
import { Bot, Briefcase, Code2, ClipboardList, Palette, AlertCircle } from 'lucide-react';

const AGENT_META: Record<AgentType, { icon: typeof Bot; label: string; color: string; bgAccent: string }> = {
  manager: { icon: Briefcase, label: 'Manager', color: 'text-primary-400', bgAccent: 'bg-primary-500/10' },
  coder: { icon: Code2, label: 'Coder', color: 'text-agent-coder', bgAccent: 'bg-agent-coder/10' },
  pm: { icon: ClipboardList, label: 'PM', color: 'text-agent-pm', bgAccent: 'bg-agent-pm/10' },
  designer: { icon: Palette, label: 'Designer', color: 'text-agent-designer', bgAccent: 'bg-agent-designer/10' },
  general: { icon: Bot, label: 'General', color: 'text-agent-general', bgAccent: 'bg-agent-general/10' },
};

const VARIANT_CLASSES: Record<DecisionOption['variant'], string> = {
  primary: 'bg-success-500/15 text-success-400 hover:bg-success-500/25',
  danger: 'bg-danger-500/10 text-danger-400 hover:bg-danger-500/20',
  neutral: 'bg-surface-overlay text-text-secondary hover:bg-surface-inset hover:text-text-primary',
};

interface InlineDecisionCardProps {
  decision: Decision;
  onResolve: (decisionId: string, optionId: string) => void;
}

export function InlineDecisionCard({ decision, onResolve }: InlineDecisionCardProps) {
  const meta = AGENT_META[decision.agentType];
  const Icon = meta.icon;
  const isResolved = decision.status !== 'pending';

  return (
    <div className="ml-9 animate-fade-up">
      <div
        className={`rounded-xl border border-border bg-surface-raised overflow-hidden transition-all duration-300 ${
          isResolved ? 'opacity-60' : ''
        }`}
      >
        {/* Header */}
        <div className={`flex items-center gap-2.5 px-4 py-2.5 border-b border-border-subtle ${meta.bgAccent}`}>
          <AlertCircle size={14} className="text-warning-400" />
          <span className="text-sm font-medium text-text-primary">Decision Required</span>
          {isResolved && (
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-2xs font-medium ${
                decision.status === 'approved'
                  ? 'bg-success-500/15 text-success-400'
                  : 'bg-danger-500/15 text-danger-400'
              }`}
            >
              {decision.status.charAt(0).toUpperCase() + decision.status.slice(1)}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${meta.bgAccent} ${meta.color} border-current/20`}>
              <Icon size={12} />
              {meta.label}
            </span>
            <span className="text-sm font-medium text-text-primary">{decision.title}</span>
          </div>
          <p className="text-sm text-text-secondary leading-relaxed">{decision.description}</p>
        </div>

        {/* Actions */}
        {!isResolved && (
          <div className="border-t border-border-subtle px-4 py-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              {decision.options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => onResolve(decision.id, opt.id)}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${VARIANT_CLASSES[opt.variant]}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
