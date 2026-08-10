import { useAppStore } from '../../store/app-store';
import { conversationRepo } from '../../db/repositories/conversations';
import { messageRepo } from '../../db/repositories/messages';
import { Download, Upload, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { Conversation } from '../../types/conversation';

export function DataConfig() {
  const conversations = useAppStore((s) => s.conversations);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleExport = () => {
    const data = JSON.stringify(conversations, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `swarm-conversations-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text) as Conversation[];
        if (!Array.isArray(data)) {
          alert('Invalid file format: expected an array of conversations.');
          return;
        }
        // Persist each conversation and its messages to IndexedDB
        for (const conv of data) {
          await conversationRepo.create({
            ...conv,
            messages: [],
          } as Conversation);
          if (conv.messages?.length) {
            await messageRepo.bulkAdd(conv.messages);
          }
        }
        // Refresh the in-memory store
        await useAppStore.getState().hydrateConversations();
        alert(`Imported ${data.length} conversations successfully.`);
      } catch {
        alert('Failed to parse or import file. Please ensure it is valid JSON.');
      }
    };
    input.click();
  };

  const handleClear = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      return;
    }
    // Clear all conversations from store
    conversations.forEach((c) => {
      useAppStore.getState().deleteConversation(c.id);
    });
    setConfirmClear(false);
  };

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-text-secondary">
        Export, import, or clear your conversation data.
      </p>

      <div className="flex flex-col gap-2">
        {/* Export */}
        <button
          onClick={handleExport}
          disabled={conversations.length === 0}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-overlay disabled:opacity-40"
        >
          <Download size={15} />
          Export conversations ({conversations.length})
        </button>

        {/* Import */}
        <button
          onClick={handleImport}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface-raised px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-surface-overlay"
        >
          <Upload size={15} />
          Import conversations
        </button>

        {/* Clear */}
        <button
          onClick={handleClear}
          disabled={conversations.length === 0}
          className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-40 ${
            confirmClear
              ? 'border-danger-500/50 bg-danger-500/10 text-danger-400 hover:bg-danger-500/20'
              : 'border-border bg-surface-raised text-text-primary hover:bg-surface-overlay'
          }`}
        >
          <Trash2 size={15} />
          {confirmClear ? 'Click again to confirm' : 'Clear all conversations'}
        </button>
      </div>

      <p className="text-2xs text-text-tertiary">
        All data is stored locally in your browser using IndexedDB. Nothing is sent to any server.
      </p>
    </div>
  );
}
