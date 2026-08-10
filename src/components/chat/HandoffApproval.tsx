import { useState } from 'react';
import type { AgentType, HandoffProposal } from '@/types/agent';
import { agentDefinitions } from '@/agents/definitions';
import {
  ArrowRightLeft,
  Check,
  CheckCheck,
  Shield,
  X,
  ChevronDown,
  Code2,
  ClipboardList,
  Palette,
  Bot,
  Briefcase,
} from 'lucide-react';

const AGENT_CONFIG: Record<
  AgentType,
  { icon: typeof Bot; colorClass: string; badgeClass: string }
> = {
  manager: {
    icon: Briefcase,
    colorClass: 'text-primary-400',
    badgeClass: 'bg-primary-500/15 text-primary-400 border-primary-500/20',
  },
  general: {
    icon: Bot,
    colorClass: 'text-agent-general',
    badgeClass: 'bg-agent-general/15 text-agent-general border-agent-general/20',
  },
  coder: {
    icon: Code2,
    colorClass: 'text-agent-coder',
    badgeClass: 'bg-agent-coder/15 text-agent-coder border-agent-coder/20',
  },
  pm: {
    icon: ClipboardList,
    colorClass: 'text-agent-pm',
    badgeClass: 'bg-agent-pm/15 text-agent-pm border-agent-pm/20',
  },
  designer: {
    icon: Palette,
    colorClass: 'text-agent-designer',
    badgeClass: 'bg-agent-designer/15 text-agent-designer border-agent-designer/20',
  },
};

const ALL_AGENTS: AgentType[] = ['manager', 'general', 'coder', 'pm', 'designer'];

export type ApprovalTier = 'once' | 'route' | 'all';

interface HandoffApprovalProps {
  proposal: HandoffProposal;
  onApprove: (proposal: HandoffProposal, tier: ApprovalTier) => void;
  onReject: (proposal: HandoffProposal) => void;
  onRedirect: (proposal: HandoffProposal, redirectTo: AgentType) => void;
  /** If true, this was auto-approved (route or all) */
  autoApproved?: boolean;
}

export function HandoffApproval({
  proposal,
  onApprove,
  onReject,
  onRedirect,
  autoApproved,
}: HandoffApprovalProps) {
  const [redirectOpen, setRedirectOpen] = useState(false);
  const isResolved = proposal.status !== 'pending';

  const fromConfig = AGENT_CONFIG[proposal.fromAgent];
  const toConfig = AGENT_CONFIG[proposal.toAgent];
  const FromIcon = fromConfig.icon;
  const ToIcon = toConfig.icon;
  const fromName = agentDefinitions[proposal.fromAgent].name;
  const toName = agentDefinitions[proposal.toAgent].name;

  const redirectOptions = ALL_AGENTS.filter(
    (a) => a !== proposal.fromAgent && a !== proposal.toAgent,
  );

  return (
    <div className="ml-9 animate-fade-up">
      <div className="rounded-xl border border-border bg-surface-raised overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border-subtle bg-surface-overlay/50">
          <ArrowRightLeft size={14} className="text-primary-400" />
          <span className="text-sm font-medium text-text-primary">Agent Handoff</span>
          {autoApproved && (
            <span className="rounded-full bg-primary-500/15 px-2 py-0.5 text-2xs font-medium text-primary-400">
              Auto-approved
            </span>
          )}
          {isResolved && !autoApproved && (
            <span
              className={`ml-auto rounded-full px-2 py-0.5 text-2xs font-medium ${
                proposal.status === 'approved' || proposal.status === 'redirected'
                  ? 'bg-success-500/15 text-success-400'
                  : 'bg-danger-500/15 text-danger-400'
              }`}
            >
              {proposal.status === 'redirected'
                ? `Redirected to ${agentDefinitions[proposal.redirectedTo!].name}`
                : proposal.status.charAt(0).toUpperCase() + proposal.status.slice(1)}
            </span>
          )}
        </div>

        {/* Body */}
        <div className="px-4 py-3 space-y-3">
          {/* From -> To */}
          <div className="flex items-center gap-2.5">
            <AgentBadge icon={FromIcon} name={fromName} config={fromConfig} />
            <ArrowRightLeft size={12} className="text-text-tertiary shrink-0" />
            <AgentBadge icon={ToIcon} name={toName} config={toConfig} />
          </div>

          {/* Reason */}
          <div>
            <span className="text-2xs font-medium uppercase tracking-wide text-text-tertiary">
              Reason
            </span>
            <p className="mt-0.5 text-sm text-text-secondary leading-relaxed">
              {proposal.reason}
            </p>
          </div>

          {/* Context */}
          {proposal.context && (
            <div>
              <span className="text-2xs font-medium uppercase tracking-wide text-text-tertiary">
                Context
              </span>
              <p className="mt-0.5 text-sm text-text-secondary leading-relaxed">
                {proposal.context}
              </p>
            </div>
          )}
        </div>

        {/* Actions -- tiered approval */}
        {!isResolved && (
          <div className="border-t border-border-subtle px-4 py-2.5 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Approve once */}
              <button
                onClick={() => onApprove(proposal, 'once')}
                className="flex items-center gap-1.5 rounded-lg bg-success-500/15 px-3 py-1.5 text-xs font-medium text-success-400 hover:bg-success-500/25 transition-colors"
                title="Approve this handoff only"
              >
                <Check size={12} />
                Approve once
              </button>

              {/* Approve route */}
              <button
                onClick={() => onApprove(proposal, 'route')}
                className="flex items-center gap-1.5 rounded-lg bg-primary-500/10 px-3 py-1.5 text-xs font-medium text-primary-400 hover:bg-primary-500/20 transition-colors"
                title={`Always auto-approve ${fromName} to ${toName}`}
              >
                <CheckCheck size={12} />
                Always {fromName} &rarr; {toName}
              </button>

              {/* Approve all */}
              <button
                onClick={() => onApprove(proposal, 'all')}
                className="flex items-center gap-1.5 rounded-lg bg-surface-overlay px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-inset hover:text-text-primary transition-colors"
                title="Auto-approve all future handoffs"
              >
                <Shield size={12} />
                Approve all
              </button>

              {/* Reject */}
              <button
                onClick={() => onReject(proposal)}
                className="flex items-center gap-1.5 rounded-lg bg-danger-500/10 px-3 py-1.5 text-xs font-medium text-danger-400 hover:bg-danger-500/20 transition-colors"
              >
                <X size={12} />
                Reject
              </button>

              {/* Redirect dropdown */}
              {redirectOptions.length > 0 && (
                <div className="relative ml-auto">
                  <button
                    onClick={() => setRedirectOpen((v) => !v)}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-text-tertiary hover:bg-surface-overlay hover:text-text-secondary transition-colors"
                  >
                    Redirect to...
                    <ChevronDown size={12} />
                  </button>
                  {redirectOpen && (
                    <div className="absolute right-0 bottom-full mb-1 z-10 w-40 rounded-lg border border-border bg-surface-overlay shadow-lg overflow-hidden">
                      {redirectOptions.map((agentId) => {
                        const cfg = AGENT_CONFIG[agentId];
                        const Icon = cfg.icon;
                        const name = agentDefinitions[agentId].name;
                        return (
                          <button
                            key={agentId}
                            onClick={() => {
                              setRedirectOpen(false);
                              onRedirect(proposal, agentId);
                            }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-xs text-text-secondary hover:bg-surface-raised hover:text-text-primary transition-colors"
                          >
                            <Icon size={12} className={cfg.colorClass} />
                            {name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AgentBadge({
  icon: Icon,
  name,
  config,
}: {
  icon: typeof Bot;
  name: string;
  config: { badgeClass: string };
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${config.badgeClass}`}
    >
      <Icon size={12} />
      {name}
    </span>
  );
}
