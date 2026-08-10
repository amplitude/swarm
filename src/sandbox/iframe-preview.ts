import type { SandboxResult } from './types';
import { IframeSandbox } from './iframe-sandbox';

/**
 * IframePreview wraps IframeSandbox specifically for HTML/CSS/JS preview rendering.
 * It manages a visible iframe in a container element and provides a simple API
 * for rendering HTML content and capturing console output.
 */
export class IframePreview {
  private sandbox = new IframeSandbox();

  /**
   * Mount the preview iframe into a container element.
   * The iframe renders with sandbox="allow-scripts" and CSP blocking network access.
   */
  mount(container: HTMLElement): void {
    const iframe = this.sandbox.create(container);
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.backgroundColor = '#fff';
  }

  /**
   * Render HTML content inside the sandboxed iframe.
   * Console output (log/warn/error/info) is captured and returned in the result.
   */
  async render(html: string, options?: { timeout?: number }): Promise<SandboxResult> {
    return this.sandbox.execute(html, {
      mode: 'html',
      timeout: options?.timeout ?? 10000,
    });
  }

  /**
   * Execute JavaScript code inside the sandboxed iframe.
   * Returns the eval result and captured console output.
   */
  async executeJS(code: string, options?: { timeout?: number }): Promise<SandboxResult> {
    return this.sandbox.execute(code, {
      mode: 'js',
      timeout: options?.timeout ?? 5000,
    });
  }

  /**
   * Get the underlying iframe element (for sizing, visibility, etc).
   */
  getIframe(): HTMLIFrameElement | null {
    return this.sandbox.getIframe();
  }

  /**
   * Destroy the iframe and clean up event listeners.
   */
  dispose(): void {
    this.sandbox.dispose();
  }
}
