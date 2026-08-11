import { useRef, useState, useCallback, useEffect, type KeyboardEvent } from 'react';
import { useAppStore } from '../../store/app-store';
import { useChat } from '../../hooks/use-chat';
import { SendHorizonal, Square, RotateCcw, AlertTriangle } from 'lucide-react';

interface ChatInputProps {
  placeholderOverride?: string;
}

export function ChatInput({ placeholderOverride }: ChatInputProps) {
  const [value, setValue] = useState(() => {
    // Restore draft from sessionStorage
    try {
      return sessionStorage.getItem('swarm-draft') || '';
    } catch {
      return '';
    }
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const llmStatus = useAppStore((s) => s.llmStatus);
  const isThinking = useAppStore((s) => s.agentState[s.activeAgent].isThinking);
  const { sendMessage, stop, retry, chatError, clearError } = useChat();

  // Persist draft to sessionStorage
  useEffect(() => {
    try {
      if (value) {
        sessionStorage.setItem('swarm-draft', value);
      } else {
        sessionStorage.removeItem('swarm-draft');
      }
    } catch { /* ignore */ }
  }, [value]);

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    clearError();
    sendMessage(trimmed);

    setValue('');
    try { sessionStorage.removeItem('swarm-draft'); } catch { /* ignore */ }
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  }, [value, sendMessage, clearError]);

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

  const isGenerating = isThinking;
  const isModelLoading = llmStatus === 'loading';
  const isModelError = llmStatus === 'error';
  const isModelUnavailable = llmStatus === 'idle';
  const canSend = value.trim() && !isGenerating && !isModelLoading && llmStatus === 'ready';

  // Determine disabled reason for tooltip
  const getDisabledReason = (): string | null => {
    if (!value.trim()) return null;
    if (isGenerating) return 'Already generating';
    if (isModelLoading) return 'Model is downloading...';
    if (isModelError) return 'Model failed to load. Retry from status bar.';
    if (isModelUnavailable) return 'WebGPU unavailable. Draft only.';
    return null;
  };

  const disabledReason = getDisabledReason();

  return (
    <div className="border-t border-border bg-surface px-4 py-3">
      <div className="mx-auto max-w-3xl">
        {/* Error state */}
        {chatError && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-danger-500/30 bg-danger-500/10 px-3 py-2">
            <AlertTriangle size={12} className="shrink-0 text-danger-400" />
            <span className="text-xs text-danger-300 flex-1">{chatError.message}</span>
            {chatError.type === 'error' && (
              <button
                onClick={retry}
                className="flex items-center gap-1 rounded px-2 py-1 text-2xs font-medium text-danger-300 hover:bg-danger-500/20 transition-colors"
              >
                <RotateCcw size={10} />
                Retry
              </button>
            )}
            <button
              onClick={clearError}
              className="text-2xs text-text-tertiary hover:text-text-secondary"
            >
              Dismiss
            </button>
          </div>
        )}

        <div className="flex items-end gap-2 rounded-xl border border-border bg-surface-raised px-3 py-2 transition-colors focus-within:border-primary-500/40">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onInput={handleInput}
            placeholder={placeholderOverride || 'Type a message...'}
            disabled={isGenerating}
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none disabled:opacity-50"
          />
          {isGenerating ? (
            <button
              onClick={stop}
              title="Stop generation"
              className="flex shrink-0 items-center justify-center rounded-lg h-7 w-7 bg-danger-600 text-white hover:bg-danger-500 transition-colors"
            >
              <Square size={12} />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!canSend}
              title={disabledReason || 'Send message (Enter)'}
              className="flex shrink-0 items-center justify-center rounded-lg h-7 w-7 bg-primary-600 text-white transition-colors hover:bg-primary-500 disabled:opacity-30 disabled:hover:bg-primary-600"
            >
              <SendHorizonal size={14} />
            </button>
          )}
        </div>

        {/* Status hint */}
        <p className="mt-1.5 text-center text-2xs text-text-tertiary">
          {isGenerating
            ? 'Generating... press ■ to stop'
            : disabledReason
              ? disabledReason
              : 'Press Enter to send, Shift+Enter for new line'}
        </p>
      </div>
    </div>
  );
}
