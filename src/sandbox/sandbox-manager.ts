import type { SandboxResult, SandboxOptions } from './types';
import { IframeSandbox } from './iframe-sandbox';
import { QuickJSSandbox } from './quickjs-sandbox';

const DOM_PATTERNS = [
  /document\./,
  /\bDOM\b/,
  /<\s*(html|div|span|p|h[1-6]|body|head|style|script|canvas|svg|img|a|ul|ol|li|table|form|input|button|select|textarea)\b/i,
  /\bgetElementBy/,
  /\bquerySelector/,
  /\binnerHTML\b/,
  /\bwindow\./,
  /\balert\s*\(/,
];

function containsHtmlOrDom(code: string): boolean {
  return DOM_PATTERNS.some((re) => re.test(code));
}

export class SandboxManager {
  private iframeSandbox: IframeSandbox | null = null;
  private quickjsSandbox: QuickJSSandbox | null = null;

  async execute(code: string, options: SandboxOptions = {}): Promise<SandboxResult> {
    const mode = options.mode ?? (containsHtmlOrDom(code) ? 'html' : 'js');

    if (mode === 'html') {
      return this.executeInIframe(code, options);
    }
    return this.executeInQuickJS(code, options);
  }

  private async executeInIframe(code: string, options: SandboxOptions): Promise<SandboxResult> {
    if (!this.iframeSandbox) {
      this.iframeSandbox = new IframeSandbox();
      this.iframeSandbox.create();
      // Wait for iframe to be ready
      await new Promise((r) => setTimeout(r, 100));
    }
    return this.iframeSandbox.execute(code, {
      timeout: options.timeout,
      mode: 'html',
    });
  }

  private async executeInQuickJS(code: string, options: SandboxOptions): Promise<SandboxResult> {
    if (!this.quickjsSandbox) {
      this.quickjsSandbox = new QuickJSSandbox();
    }
    return this.quickjsSandbox.evaluate(code, { timeout: options.timeout });
  }

  getIframeSandbox(): IframeSandbox | null {
    return this.iframeSandbox;
  }

  dispose() {
    this.iframeSandbox?.dispose();
    this.iframeSandbox = null;
    this.quickjsSandbox?.dispose();
    this.quickjsSandbox = null;
  }
}

export const sandboxManager = new SandboxManager();
