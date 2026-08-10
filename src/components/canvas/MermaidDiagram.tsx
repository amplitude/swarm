import { useEffect, useRef, useState, useCallback } from 'react';

let mermaidInitialized = false;

async function getMermaid() {
  const m = await import('mermaid');
  if (!mermaidInitialized) {
    m.default.initialize({
      startOnLoad: false,
      theme: 'dark',
      securityLevel: 'strict',
    });
    mermaidInitialized = true;
  }
  return m.default;
}

interface MermaidDiagramProps {
  definition: string;
  className?: string;
  onClick?: () => void;
  expanded?: boolean;
}

export function MermaidDiagram({ definition, className, onClick, expanded }: MermaidDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [translate, setTranslate] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });
  const idRef = useRef(`mermaid-${Date.now()}-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    let cancelled = false;

    async function render() {
      try {
        const mermaid = await getMermaid();
        const { svg } = await mermaid.render(idRef.current, definition);
        if (!cancelled) {
          setSvgContent(svg);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to render diagram');
          setSvgContent('');
        }
      }
    }

    render();
    return () => { cancelled = true; };
  }, [definition]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!expanded) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale((s) => Math.min(Math.max(s * delta, 0.1), 5));
  }, [expanded]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!expanded) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX - translate.x, y: e.clientY - translate.y };
  }, [expanded, translate]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning) return;
    setTranslate({
      x: e.clientX - panStart.current.x,
      y: e.clientY - panStart.current.y,
    });
  }, [isPanning]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  const exportAs = useCallback(async (format: 'svg' | 'png') => {
    if (!svgContent) return;

    if (format === 'svg') {
      const blob = new Blob([svgContent], { type: 'image/svg+xml' });
      downloadBlob(blob, 'diagram.svg');
      return;
    }

    // PNG export via canvas
    const img = new Image();
    const svgBlob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(svgBlob);

    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width * 2;
      canvas.height = img.height * 2;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(2, 2);
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      canvas.toBlob((blob) => {
        if (blob) downloadBlob(blob, 'diagram.png');
      });
    };
    img.src = url;
  }, [svgContent]);

  if (error) {
    return (
      <div className={`rounded-lg border border-red-500/30 bg-red-950/20 p-4 ${className ?? ''}`}>
        <p className="text-sm text-red-400">Mermaid syntax error:</p>
        <pre className="mt-1 text-xs text-red-300 whitespace-pre-wrap">{error}</pre>
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div className={`flex items-center justify-center p-4 ${className ?? ''}`}>
        <div className="text-sm text-zinc-400">Rendering diagram...</div>
      </div>
    );
  }

  return (
    <div className={`relative group ${className ?? ''}`}>
      <div
        ref={containerRef}
        className={`overflow-hidden ${expanded ? 'cursor-grab' : 'cursor-pointer'} ${isPanning ? 'cursor-grabbing' : ''}`}
        onClick={expanded ? undefined : onClick}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={expanded ? { transform: `translate(${translate.x}px, ${translate.y}px) scale(${scale})`, transformOrigin: 'center center' } : undefined}
        dangerouslySetInnerHTML={{ __html: svgContent }}
      />
      {expanded && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => exportAs('svg')}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
          >
            SVG
          </button>
          <button
            onClick={() => exportAs('png')}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
          >
            PNG
          </button>
          <button
            onClick={() => { setScale(1); setTranslate({ x: 0, y: 0 }); }}
            className="rounded bg-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-600"
          >
            Reset
          </button>
        </div>
      )}
    </div>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
