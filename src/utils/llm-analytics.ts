import type { AgentType } from '@/types/agent';
import { nanoid } from 'nanoid';

// ---------------------------------------------------------------------------
// Trace ID management
// ---------------------------------------------------------------------------

export function createTraceId(): string {
  return nanoid();
}

// ---------------------------------------------------------------------------
// Timer helper
// ---------------------------------------------------------------------------

export function startTimer(): () => number {
  const start = performance.now();
  return () => Math.round(performance.now() - start);
}

// ---------------------------------------------------------------------------
// Stub types for analytics (no-op - telemetry removed)
// These functions are kept as no-ops since they're referenced by
// orchestrator.ts and llm-chat-adapter.ts. All PostHog integration
// has been removed to respect the fully-offline privacy model.
// ---------------------------------------------------------------------------

export interface GenerationParams {
  traceId: string;
  model: string;
  inputMessages: Array<{ role: string; content: string }>;
  outputContent: string | null;
  toolCalls?: Array<{ id: string; function: { name: string; arguments: string } }>;
  finishReason: string;
  latencyMs: number;
  timeToFirstTokenMs?: number;
  temperature?: number;
  tools?: Array<{ type: string; function: { name: string; description: string; parameters: Record<string, unknown> } }>;
  inputTokens?: number;
  outputTokens?: number;
}

export function captureGeneration(_params: GenerationParams): void {
  // No-op: telemetry removed
}

export function captureGenerationError(_params: {
  traceId: string;
  model: string;
  inputMessages: Array<{ role: string; content: string }>;
  error: string;
  latencyMs: number;
  temperature?: number;
}): void {
  // No-op: telemetry removed
}

export interface TraceParams {
  traceId: string;
  agentType: AgentType;
  durationMs: number;
  iterations: number;
  toolCalls: Array<{ toolId: string }>;
  hasHandoff: boolean;
  handoffTarget?: AgentType;
  hasFinalResponse: boolean;
}

export function captureTrace(_params: TraceParams): void {
  // No-op: telemetry removed
}

export interface ToolCallTrackingParams {
  traceId: string;
  toolName: string;
  toolParameters: Record<string, unknown>;
  result: { success: boolean; output?: unknown; error?: string };
  durationMs: number;
  agentType: AgentType;
}

export function captureToolCall(_params: ToolCallTrackingParams): void {
  // No-op: telemetry removed
}

export function trackLLMGeneration(_traceId: string, _model: string, _input: unknown[], _output: string, _latency: number): void {
  // No-op: telemetry removed
}
