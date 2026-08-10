import type { AgentType } from './agent';

export type JSONSchema = Record<string, unknown>;

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  parameters: JSONSchema;
  execute: (params: Record<string, unknown>) => Promise<ToolResult>;
  availableTo: AgentType[];
  requiresConfirmation?: boolean;
}

export interface ToolResult {
  success: boolean;
  output: string | object;
  artifacts?: Artifact[];
  error?: string;
}

export interface ToolCallRequest {
  id: string;
  toolId: string;
  parameters: Record<string, unknown>;
}

export interface Artifact {
  id: string;
  conversationId: string;
  type: ArtifactType;
  name: string;
  content: string;
  language?: string;
  creatorAgent: AgentType;
  sharedWith?: AgentType[];
  handoffId?: string;
  createdAt: number;
  updatedAt: number;
}

export type ArtifactType = 'code' | 'diagram-mermaid' | 'diagram-excalidraw' | 'image' | 'document';

export interface ToolExecutor {
  execute(toolId: string, params: Record<string, unknown>): Promise<ToolResult>;
}

/** OpenAI-compatible function definition for LLM consumption */
export interface LLMFunctionDef {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: JSONSchema;
  };
}

export function toolToLLMFunction(tool: ToolDefinition): LLMFunctionDef {
  return {
    type: 'function',
    function: {
      name: tool.id,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
