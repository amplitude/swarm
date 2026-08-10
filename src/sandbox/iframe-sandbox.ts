import type { SandboxResult, SandboxResponse } from './types';

const SANDBOX_SRCDOC = `<!DOCTYPE html>
<html>
<head>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline';">
<style>body{margin:0;font-family:system-ui,sans-serif;}</style>
</head>
<body>
<script>
(function(){
  const logs = [];
  const orig = {};
  ['log','warn','error','info'].forEach(function(level){
    orig[level] = console[level];
    console[level] = function(){
      const args = Array.from(arguments).map(function(a){
        try { return typeof a === 'string' ? a : JSON.stringify(a); }
        catch(e) { return String(a); }
      });
      logs.push({ level: level, args: args, timestamp: Date.now() });
      orig[level].apply(console, arguments);
    };
  });

  window.addEventListener('message', function(e) {
    if (!e.data || e.data.type !== 'execute') return;
    const msg = e.data;
    const start = performance.now();
    try {
      if (msg.mode === 'html') {
        document.body.innerHTML = msg.code;
        const scripts = document.body.querySelectorAll('script');
        scripts.forEach(function(s) {
          const ns = document.createElement('script');
          ns.textContent = s.textContent;
          s.replaceWith(ns);
        });
        parent.postMessage({
          type: 'result', id: msg.id,
          result: { success: true, logs: logs.splice(0), executionTimeMs: performance.now() - start }
        }, '*');
      } else {
        const result = eval(msg.code);
        parent.postMessage({
          type: 'result', id: msg.id,
          result: {
            success: true,
            value: result !== undefined ? String(result) : undefined,
            logs: logs.splice(0),
            executionTimeMs: performance.now() - start
          }
        }, '*');
      }
    } catch(err) {
      parent.postMessage({
        type: 'result', id: msg.id,
        result: {
          success: false,
          error: err instanceof Error ? err.message : String(err),
          logs: logs.splice(0),
          executionTimeMs: performance.now() - start
        }
      }, '*');
    }
  });

  parent.postMessage({ type: 'ready' }, '*');
})();
<\/script>
</body>
</html>`;

export class IframeSandbox {
  private iframe: HTMLIFrameElement | null = null;
  private pending = new Map<string, {
    resolve: (r: SandboxResult) => void;
    timer: ReturnType<typeof setTimeout>;
  }>();
  private counter = 0;
  private messageHandler: ((e: MessageEvent) => void) | null = null;

  create(container?: HTMLElement): HTMLIFrameElement {
    this.dispose();

    const iframe = document.createElement('iframe');
    iframe.sandbox.add('allow-scripts');
    iframe.srcdoc = SANDBOX_SRCDOC;
    iframe.style.border = 'none';
    iframe.style.width = '100%';
    iframe.style.height = '100%';

    this.messageHandler = (e: MessageEvent) => {
      if (e.source !== iframe.contentWindow) return;
      const data = e.data as SandboxResponse;
      if (data?.type === 'result' && this.pending.has(data.id)) {
        const entry = this.pending.get(data.id)!;
        clearTimeout(entry.timer);
        this.pending.delete(data.id);
        entry.resolve(data.result);
      }
    };
    window.addEventListener('message', this.messageHandler);

    this.iframe = iframe;
    (container ?? document.body).appendChild(iframe);
    return iframe;
  }

  execute(code: string, options: { timeout?: number; mode?: 'js' | 'html' } = {}): Promise<SandboxResult> {
    return new Promise((resolve) => {
      if (!this.iframe?.contentWindow) {
        resolve({
          success: false,
          error: 'Sandbox iframe not initialized',
          logs: [],
          executionTimeMs: 0,
        });
        return;
      }

      const id = `exec_${++this.counter}`;
      const timeout = options.timeout ?? 5000;

      const timer = setTimeout(() => {
        this.pending.delete(id);
        this.recreate();
        resolve({
          success: false,
          error: `Execution timed out after ${timeout}ms`,
          logs: [],
          executionTimeMs: timeout,
        });
      }, timeout);

      this.pending.set(id, { resolve, timer });

      this.iframe.contentWindow.postMessage(
        { type: 'execute', code, id, mode: options.mode ?? 'js' },
        '*'
      );
    });
  }

  private recreate() {
    const container = this.iframe?.parentElement ?? undefined;
    this.dispose();
    this.create(container);
  }

  dispose() {
    for (const [, entry] of this.pending) {
      clearTimeout(entry.timer);
    }
    this.pending.clear();

    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
      this.messageHandler = null;
    }
    if (this.iframe) {
      this.iframe.remove();
      this.iframe = null;
    }
  }

  getIframe(): HTMLIFrameElement | null {
    return this.iframe;
  }
}
