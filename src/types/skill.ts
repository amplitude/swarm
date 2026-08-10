export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  promptFragment: string;
  examples?: FewShotExample[];
  requiredTools?: string[];
}

export interface FewShotExample {
  userMessage: string;
  assistantResponse: string;
  toolCalls?: Array<{
    toolId: string;
    parameters: Record<string, unknown>;
  }>;
}
