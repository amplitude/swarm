import type { ConsoleEntry } from './types';

/**
 * Creates console host functions for a QuickJS VM context.
 * Each call to log/warn/error/info appends to the provided logs array.
 *
 * Usage with quickjs-emscripten:
 *   const logs: ConsoleEntry[] = [];
 *   registerConsole(vm, logs);
 *   vm.evalCode('console.log("hello")');
 *   // logs now contains the captured entry
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function registerConsole(vm: any, logs: ConsoleEntry[]): void {
  const consoleHandle = vm.newObject();

  for (const level of ['log', 'warn', 'error', 'info'] as const) {
    const fn = vm.newFunction(level, (...args: unknown[]) => {
      const strArgs = args.map((a) => {
        if (typeof a === 'string') return a;
        try {
          const str = vm.getString(a);
          return str ?? String(a);
        } catch {
          return String(a);
        }
      });
      logs.push({ level, args: strArgs, timestamp: Date.now() });
    });
    vm.setProp(consoleHandle, level, fn);
    fn.dispose();
  }

  vm.setProp(vm.global, 'console', consoleHandle);
  consoleHandle.dispose();
}
