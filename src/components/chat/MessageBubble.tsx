import type { Message } from '../../types/message';
import type { AgentType } from '../../types/agent';
import type { Artifact } from '../../types/tool';
import { useAppStore } from '../../store/app-store';
import { Code2, ClipboardList, Palette, Bot, Briefcase, Wrench, ChevronDown, ChevronRight, Copy, Check, Maximize2 } from 'lucide-react';
import React, { useState, Suspense } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const MermaidDiagram = React.lazy(() =>
  import('../canvas/MermaidDiagram').then((m) => ({ default: m.MermaidDiagram }))
);
const CodePreview = React.lazy(() =>
  import('../canvas/CodePreview').then((m) => ({ default: m.CodePreview }))
);

const AGENT_CONFIG: Record<AgentType, { icon: typeof Bot; label: string; accentClass: string }> = {
  manager: { icon: Briefcase, label: 'Manager', accentClass: 'text-primary-400' },
  general: { icon: Bot, label: 'General', accentClass: 'text-agent-general' },
  coder: { icon: Code2, label: 'Coder', accentClass: 'text-agent-coder' },
  pm: { icon: ClipboardList, label: 'PM', accentClass: 'text-agent-pm' },
  designer: { icon: Palette, label: 'Designer', accentClass: 'text-agent-designer' },
};

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  if (isTool) {
    return <ToolCallBlock message={message} />;
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-xl rounded-br-sm bg-primary-600 px-3.5 py-2.5 text-sm text-white">
          <p className="whitespace-pre-wrap">{message.content}</p>
        </div>
      </div>
    );
  }

  // Assistant message
  const agentType = message.agentType || 'general';
  const config = AGENT_CONFIG[agentType];
  const Icon = config.icon;

  return (
    <div className="flex gap-2.5 animate-fade-up">
      <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-overlay ${config.accentClass}`}>
        <Icon size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <span className={`text-2xs font-medium ${config.accentClass}`}>{config.label}</span>
        <div className="mt-0.5 text-sm text-text-primary prose-invert prose-sm max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, ...props }) {
                const match = /language-(\w+)/.exec(className || '');
                const codeString = String(children).replace(/\n$/, '');
                if (match && match[1]) {
                  return <CodeBlock language={match[1]} code={codeString} />;
                }
                return (
                  <code className="rounded bg-surface-overlay px-1.5 py-0.5 font-mono text-xs text-primary-300" {...props}>
                    {children}
                  </code>
                );
              },
              p({ children }) {
                return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>;
              },
              ul({ children }) {
                return <ul className="mb-2 ml-4 list-disc space-y-0.5">{children}</ul>;
              },
              ol({ children }) {
                return <ol className="mb-2 ml-4 list-decimal space-y-0.5">{children}</ol>;
              },
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}

function CodeBlock({ language, code }: { language: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="my-2 rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between bg-surface-overlay px-3 py-1.5">
        <span className="text-2xs font-mono text-text-tertiary">{language}</span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 text-2xs text-text-tertiary hover:bg-surface-raised hover:text-text-secondary transition-colors"
        >
          {copied ? <Check size={11} /> : <Copy size={11} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="overflow-x-auto bg-surface-inset p-3 text-xs leading-relaxed">
        <code className="font-mono text-text-primary">{code}</code>
      </pre>
    </div>
  );
}

function ToolCallBlock({ message }: { message: Message }) {
  const [expanded, setExpanded] = useState(false);
  const openArtifact = useAppStore((s) => s.openArtifact);
  const toolName = message.toolCall?.toolId || 'tool';
  const isSuccess = message.toolResult?.success;
  const statusColor = isSuccess === undefined ? 'text-text-tertiary' : isSuccess ? 'text-success-400' : 'text-danger-400';

  const richContent = getRichToolContent(toolName, message);
  const artifacts = message.artifacts ?? message.toolResult?.artifacts;

  return (
    <div className="ml-9 rounded-lg border border-border bg-surface-raised overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-surface-overlay transition-colors"
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <Wrench size={12} className="text-text-tertiary" />
        <span className="font-medium text-text-secondary">{toolName}</span>
        <span className={`ml-auto text-2xs ${statusColor}`}>
          {isSuccess === undefined ? 'running...' : isSuccess ? 'done' : 'error'}
        </span>
      </button>
      {richContent && (
        <Suspense fallback={<div className="px-3 py-2 text-xs text-text-tertiary">Loading preview...</div>}>
          <div className="border-t border-border">{richContent}</div>
        </Suspense>
      )}
      {/* Open artifact in right panel */}
      {artifacts && artifacts.length > 0 && isSuccess && (
        <div className="border-t border-border px-3 py-1.5 flex gap-2">
          {artifacts.map((artifact: Artifact) => (
            <button
              key={artifact.id}
              onClick={() => openArtifact(artifact)}
              className="flex items-center gap-1 rounded px-2 py-1 text-2xs text-text-tertiary hover:bg-surface-overlay hover:text-text-secondary transition-colors"
            >
              <Maximize2 size={10} />
              Open {artifact.name}
            </button>
          ))}
        </div>
      )}
      {expanded && (
        <div className="border-t border-border px-3 py-2">
          {message.toolCall && (
            <div className="mb-2">
              <span className="text-2xs font-medium text-text-tertiary">Input</span>
              <pre className="mt-0.5 overflow-x-auto text-xs font-mono text-text-secondary">
                {JSON.stringify(message.toolCall.parameters, null, 2)}
              </pre>
            </div>
          )}
          {message.toolResult && (
            <div>
              <span className="text-2xs font-medium text-text-tertiary">Output</span>
              <pre className="mt-0.5 overflow-x-auto text-xs font-mono text-text-secondary">
                {typeof message.toolResult.output === 'string'
                  ? message.toolResult.output
                  : JSON.stringify(message.toolResult.output, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function getRichToolContent(toolName: string, message: Message): React.ReactNode | null {
  const result = message.toolResult;
  if (!result?.success) return null;

  if (toolName === 'render_mermaid') {
    const definition = message.toolCall?.parameters?.['definition'] as string | undefined;
    if (definition) {
      return (
        <div className="p-3 max-h-[300px] overflow-auto bg-surface-inset">
          <MermaidDiagram definition={definition} />
        </div>
      );
    }
  }

  if (toolName === 'run_javascript') {
    const code = message.toolCall?.parameters?.['code'] as string | undefined;
    if (code) {
      return (
        <div className="h-[250px]">
          <CodePreview code={code} mode="js" autoRun />
        </div>
      );
    }
  }

  if (toolName === 'preview_html') {
    const html = message.toolCall?.parameters?.['html'] as string | undefined;
    if (html) {
      return (
        <div className="h-[300px]">
          <CodePreview code={html} mode="html" autoRun />
        </div>
      );
    }
  }

  return null;
}
