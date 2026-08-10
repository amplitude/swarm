import type { SandboxResult, ConsoleEntry } from './types';

let getQuickJS: (() => Promise<unknown>) | null = null;

async function loadQuickJS() {
  if (!getQuickJS) {
    const mod = await import('quickjs-emscripten');
    getQuickJS = mod.getQuickJS;
  }
  return getQuickJS();
}

export class QuickJSSandbox {
  private quickJS: Awaited<ReturnType<typeof loadQuickJS>> | null = null;

  async init(): Promise<void> {
    this.quickJS = await loadQuickJS();
  }

  async evaluate(code: string, options: { timeout?: number } = {}): Promise<SandboxResult> {
    if (!this.quickJS) {
      await this.init();
    }

    const logs: ConsoleEntry[] = [];
    const timeout = options.timeout ?? 5000;
    const start = performance.now();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const QJS = this.quickJS as any;
    const vm = QJS.newContext();

    try {
      // Set up interrupt handler for timeout
      let iterations = 0;
      const maxIterations = 1_000_000;
      vm.runtime.setInterruptHandler(() => {
        iterations++;
        if (iterations > maxIterations || performance.now() - start > timeout) {
          return true; // interrupt
        }
        return false;
      });

      // Register console.log/warn/error/info
      const consoleHandle = vm.newObject();
      for (const level of ['log', 'warn', 'error', 'info'] as const) {
        const fn = vm.newFunction(level, (...args: unknown[]) => {
          const strArgs = args.map((a) => {
            if (typeof a === 'string') return a;
            const str = vm.getString(a);
            return str ?? String(a);
          });
          logs.push({ level, args: strArgs, timestamp: Date.now() });
        });
        vm.setProp(consoleHandle, level, fn);
        fn.dispose();
      }
      vm.setProp(vm.global, 'console', consoleHandle);
      consoleHandle.dispose();

      // Execute the code
      const result = vm.evalCode(code);

      if (result.error) {
        const errorStr = vm.dump(result.error);
        result.error.dispose();
        return {
          success: false,
          error: typeof errorStr === 'object' ? errorStr.message ?? JSON.stringify(errorStr) : String(errorStr),
          logs,
          executionTimeMs: performance.now() - start,
        };
      }

      const value = vm.dump(result.value);
      result.value.dispose();

      return {
        success: true,
        value: value !== undefined ? (typeof value === 'string' ? value : JSON.stringify(value)) : undefined,
        logs,
        executionTimeMs: performance.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        logs,
        executionTimeMs: performance.now() - start,
      };
    } finally {
      vm.dispose();
    }
  }

  dispose() {
    this.quickJS = null;
  }
}

export const quickJSSandbox = new QuickJSSandbox();
