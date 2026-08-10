export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info';
  args: string[];
  timestamp: number;
}

export interface SandboxResult {
  success: boolean;
  value?: string;
  error?: string;
  logs: ConsoleEntry[];
  executionTimeMs: number;
}

export interface SandboxMessage {
  type: 'execute';
  code: string;
  id: string;
}

export interface SandboxResponse {
  type: 'result';
  id: string;
  result: SandboxResult;
}

export interface SandboxOptions {
  timeout?: number;
  mode?: 'js' | 'html';
}
