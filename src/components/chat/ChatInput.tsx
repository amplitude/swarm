import { useRef, useState, useCallback, type KeyboardEvent } from 'react';
import { useAppStore } from '../../store/app-store';
import { useChat } from '../../hooks/use-chat';
import { SendHorizonal } from 'lucide-react';
import type { AgentType } from '../../types/agent';

const AGENT_PLACEHOLDER: Record<AgentType, string> = {
  manager: 'What can I help you with?',
  general: 'Ask anything...',
  coder: 'Ask the Coder agent...',
  pm: 'Ask the PM agent...',
  designer: 'Ask the Designer agent...',
};

const AGENT_BORDER: Record<AgentType, string> = {
  manager: 'focus-within:border-primary-500/40',
  general: 'focus-within:border-agent-general/40',
  coder: 'focus-within:border-agent-coder/40',
  pm: 'focus-within:border-agent-pm/40',
  designer: 'focus-within:border-agent-designer/40',
};

interface ChatInputProps {
  placeholderOverride?: string;
  variant?: 'default' | 'manager';
}

export function ChatInput({ placeholderOverride, variant = 'default' }: ChatInputProps) {
  const [value, setValue] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activeAgent = useAppStore((s) => s.activeAgent);
  const llmStatus = useAppStore((s) => s.llmStatus);
  const isThinking = useAppStore((s) => s.agentState[s.activeAgent].isThinking);
  const { sendMessage } = useChat();

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    sendMessage(trimmed);

    setValue('');
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, sendMessage]);

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleInput = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  };

  const isManager = variant === 'manager';

  return (
    <div className={`border-t border-border bg-surface px-4 ${isManager ? 'py-4' : 'py-3'}`}>
      <div className={isManager ? 'mx-auto' : 'mx-auto max-w-3xl'}>
        <div
          className={`flex items-end gap-2 rounded-xl border border-border bg-surface-raised px-3 ${isManager ? 'py-3' : 'py-2'} transition-colors ${AGENT_BORDER[activeAgent]}`}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholderOverride ?? AGENT_PLACEHOLDER[activeAgent]}
            rows={1}
            className={`flex-1 resize-none bg-transparent text-text-primary placeholder:text-text-tertiary outline-none ${isManager ? 'text-sm' : 'text-sm'}`}
          />
          <button
            onClick={handleSend}
            disabled={!value.trim() || isThinking || (llmStatus !== 'ready' && llmStatus !== 'generating')}
            className={`flex shrink-0 items-center justify-center rounded-lg bg-primary-600 text-white transition-colors hover:bg-primary-500 disabled:opacity-30 disabled:hover:bg-primary-600 ${isManager ? 'h-8 w-8' : 'h-7 w-7'}`}
          >
            <SendHorizonal size={isManager ? 16 : 14} />
          </button>
        </div>
        <p className="mt-1.5 text-center text-2xs text-text-tertiary">
          Press Enter to send, Shift+Enter for new line
        </p>
      </div>
    </div>
  );
}
