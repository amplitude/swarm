import Editor from '@monaco-editor/react';
import { useAppStore } from '@/store/app-store';

interface CodeEditorProps {
  value: string;
  language?: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
}

export function CodeEditor({
  value,
  language = 'javascript',
  readOnly = false,
  onChange,
}: CodeEditorProps) {
  const theme = useAppStore((s) => s.theme);

  return (
    <div className="flex-1 overflow-hidden">
      <Editor
        value={value}
        language={language}
        theme={theme === 'dark' ? 'vs-dark' : 'light'}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          lineNumbers: 'on',
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          tabSize: 2,
          automaticLayout: true,
          padding: { top: 8 },
          renderLineHighlight: readOnly ? 'none' : 'line',
          domReadOnly: readOnly,
        }}
        onChange={(val) => onChange?.(val ?? '')}
      />
    </div>
  );
}
