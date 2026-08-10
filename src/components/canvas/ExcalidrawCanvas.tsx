import { useEffect, useRef, useState, lazy, Suspense, useCallback } from 'react';

// Using any for the Excalidraw API since its internal types are complex and version-specific
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ExcalidrawAPI = any;

// Lazy-load Excalidraw to reduce initial bundle size
const ExcalidrawComponent = lazy(async () => {
  const mod = await import('@excalidraw/excalidraw');
  return { default: mod.Excalidraw };
});

// Lazy-load export utilities from Excalidraw
async function getExcalidrawUtils() {
  const mod = await import('@excalidraw/excalidraw');
  return { exportToSvg: mod.exportToSvg, exportToClipboard: mod.exportToClipboard };
}

interface ExcalidrawCanvasProps {
  elements?: readonly Record<string, unknown>[];
  className?: string;
  onClick?: () => void;
  expanded?: boolean;
  onSave?: (elements: readonly Record<string, unknown>[]) => void;
}

export function ExcalidrawCanvas({
  elements,
  className,
  onClick,
  expanded,
  onSave,
}: ExcalidrawCanvasProps) {
  const apiRef = useRef<ExcalidrawAPI | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (isReady && apiRef.current && elements) {
      apiRef.current.updateScene({
        elements: elements as any,
      });
    }
  }, [elements, isReady]);

  const handleChange = useCallback(() => {
    if (onSave && apiRef.current) {
      const currentElements = apiRef.current.getSceneElements();
      onSave(currentElements as unknown as readonly Record<string, unknown>[]);
    }
  }, [onSave]);

  const exportToSvg = useCallback(async () => {
    if (!apiRef.current) return;
    const utils = await getExcalidrawUtils();
    const sceneElements = apiRef.current.getSceneElements();
    const appState = apiRef.current.getAppState();
    const svg = await utils.exportToSvg({
      elements: sceneElements,
      appState: { ...appState, exportWithDarkMode: true },
      files: apiRef.current.getFiles(),
    });
    const svgStr = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgStr], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'excalidraw-drawing.svg';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const exportToClipboard = useCallback(async () => {
    if (!apiRef.current) return;
    const utils = await getExcalidrawUtils();
    const sceneElements = apiRef.current.getSceneElements();
    const appState = apiRef.current.getAppState();
    await utils.exportToClipboard({
      elements: sceneElements,
      appState,
      files: apiRef.current.getFiles(),
      type: 'png',
    });
  }, []);

  // Thumbnail mode: render a static preview
  if (!expanded) {
    return (
      <div
        className={`relative cursor-pointer rounded-lg border border-zinc-700 bg-zinc-900 overflow-hidden ${className ?? ''}`}
        onClick={onClick}
        style={{ minHeight: 120 }}
      >
        <div className="flex items-center justify-center h-full min-h-[120px] text-zinc-400 text-sm">
          <div className="text-center">
            <svg className="mx-auto mb-1 w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Excalidraw Drawing
            {elements && <span className="block text-xs text-zinc-500">{elements.length} elements</span>}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative group ${className ?? ''}`} style={{ height: '100%', minHeight: 400 }}>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full text-zinc-400">
            Loading Excalidraw...
          </div>
        }
      >
        <ExcalidrawComponent
          excalidrawAPI={(api: ExcalidrawAPI) => {
            apiRef.current = api;
            setIsReady(true);
          }}
          onChange={handleChange}
          theme="dark"
          initialData={{
            elements: (elements as any) ?? [],
            appState: { viewBackgroundColor: '#1a1a2e' },
          }}
        />
      </Suspense>
      {isReady && (
        <div className="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={exportToSvg}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
          >
            SVG
          </button>
          <button
            onClick={exportToClipboard}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
          >
            Copy PNG
          </button>
        </div>
      )}
    </div>
  );
}
