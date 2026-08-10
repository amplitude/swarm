import { nanoid } from 'nanoid';
import type { AgentType, AgentTurn, HandoffProposal } from '@/types/agent';
import type { Message } from '@/types/message';
import type { ToolCallRequest, ToolExecutor, ToolResult } from '@/types/tool';
import { getAgent } from './definitions';
import { createHandoffProposal, buildHandoffMessages } from './handoff';
import { routeMessage } from './router';
import { buildSystemPrompt } from './prompt-builder';
import { toolRegistry } from '@/tools/registry';
import {
  createTraceId,
  captureTrace,
  captureToolCall,
  startTimer,
} from '@/utils/llm-analytics';

// ---------------------------------------------------------------------------
// Public interfaces
// ---------------------------------------------------------------------------

/** Callbacks for the UI to observe orchestrator progress */
export interface OrchestratorCallbacks {
  /** A handoff was proposed -- the UI should render an approval widget */
  onHandoffProposed?: (proposal: HandoffProposal) => void;
  onToolCallStart?: (toolCall: ToolCallRequest) => void;
  onToolCallEnd?: (toolCall: ToolCallRequest, result: ToolResult) => void;
  onIteration?: (iteration: number, maxIterations: number) => void;
  onToken?: (token: string) => void;
}

/**
 * Minimal LLM interface so the orchestrator does not depend on web-llm types.
 */
export interface LLMChat {
  chatCompletion(request: {
    messages: Array<{ role: string; content: string; tool_call_id?: string }>;
    tools?: Array<{
      type: 'function';
      function: { name: string; description: string; parameters: Record<string, unknown> };
    }>;
    temperature?: number;
  }): Promise<LLMChatResponse>;
  getModelId?(): string | null;
  setTraceId?(traceId: string): void;
}

export interface LLMChatResponse {
  content: string | null;
  toolCalls?: Array<{
    id: string;
    function: { name: string; arguments: string };
  }>;
  finishReason: 'stop' | 'tool_calls' | 'length';
}

// ---------------------------------------------------------------------------
// Orchestrator
// ---------------------------------------------------------------------------

/**
 * Human-in-the-loop, handoff-based orchestrator.
 *
 * Flow:
 *   1. User talks to the active agent.
 *   2. Agent runs an observe-think-act loop (tool calls are executed inline).
 *   3. If the agent proposes a handoff, the loop STOPS and returns a
 *      `pendingHandoff` to the UI. The user sees an approval widget.
 *   4. On approval  -> call `approveHandoff()` to switch agents and continue.
 *      On rejection -> call `rejectHandoff()` to resume the current agent.
 *      On redirect  -> call `redirectHandoff()` to switch to a different agent.
 *   5. The user can also manually switch agents at any time via `switchAgent()`.
 *
 * The receiving agent always sees the FULL shared conversation history,
 * plus a handoff context message at the boundary.
 */
export class Orchestrator {
  private llm: LLMChat;
  private toolExecutor: ToolExecutor;
  private callbacks: OrchestratorCallbacks;

  constructor(
    llm: LLMChat,
    toolExecutor: ToolExecutor,
    callbacks: OrchestratorCallbacks = {},
  ) {
    this.llm = llm;
    this.toolExecutor = toolExecutor;
    this.callbacks = callbacks;
  }

  /**
   * Run a single agent turn. Returns when the agent either:
   * - Produces a final text response
   * - Proposes a handoff (turn.pendingHandoff is set, awaiting user action)
   * - Hits the max iteration limit
   *
   * Handoffs do NOT execute automatically. The caller must use
   * approveHandoff / rejectHandoff / redirectHandoff to proceed.
   */
  async runTurn(
    conversationMessages: Message[],
    activeAgent: AgentType,
    enabledToolIds?: Set<string>,
  ): Promise<AgentTurn> {
    const traceId = createTraceId();
    const turnTimer = startTimer();

    const turn: AgentTurn = {
      agentId: activeAgent,
      messages: [],
      toolCalls: [],
      iterations: 0,
    };

    const agent = getAgent(activeAgent);
    const systemPrompt = buildSystemPrompt(agent);
    const conversationId = conversationMessages[0]?.conversationId ?? '';

    // Pass trace ID to the LLM adapter for $ai_generation tracking
    if (this.llm.setTraceId) {
      this.llm.setTraceId(traceId);
    }

    // Build LLM context: system prompt + full shared conversation history
    const llmMessages: Array<{ role: string; content: string; tool_call_id?: string }> = [
      { role: 'system', content: systemPrompt },
      ...conversationMessages.map((m) => ({
        role: m.role,
        content: m.content,
        ...(m.toolCall ? { tool_call_id: m.toolCall.id } : {}),
      })),
    ];

    // Tools enabled for this agent (filtered by user settings if provided)
    const agentTools = toolRegistry.getEnabledToolsForAgent(activeAgent, enabledToolIds);
    const toolDefs = agentTools.map((t) => ({
      type: 'function' as const,
      function: {
        name: t.id,
        description: t.description,
        parameters: t.parameters,
      },
    }));

    // ----- Think-Act loop -----
    while (turn.iterations < agent.maxIterations) {
      turn.iterations++;
      this.callbacks.onIteration?.(turn.iterations, agent.maxIterations);

      const response = await this.llm.chatCompletion({
        messages: llmMessages,
        tools: toolDefs.length > 0 ? toolDefs : undefined,
        temperature: agent.temperature,
      });

      // --- Tool calls ---
      if (response.finishReason === 'tool_calls' && response.toolCalls?.length) {
        for (const tc of response.toolCalls) {
          let params: Record<string, unknown>;
          try {
            params = JSON.parse(tc.function.arguments);
          } catch {
            params = {};
          }

          const toolCall: ToolCallRequest = {
            id: tc.id || nanoid(),
            toolId: tc.function.name,
            parameters: params,
          };
          turn.toolCalls.push(toolCall);

          // ---- HANDOFF: stop the loop and yield to the user ----
          if (tc.function.name === 'handoff_to_agent') {
            const proposal = createHandoffProposal(activeAgent, params);

            if (proposal) {
              turn.pendingHandoff = proposal;
              this.callbacks.onHandoffProposed?.(proposal);

              // Add an assistant message explaining the handoff proposal
              const proposalMsg: Message = {
                id: nanoid(),
                conversationId,
                role: 'assistant',
                content: `I'd like to hand this off to **${getAgent(proposal.toAgent).name}** because: ${proposal.reason}${proposal.context ? `\n\nContext I'd share: ${proposal.context}` : ''}`,
                agentType: activeAgent,
                timestamp: Date.now(),
                metadata: {
                  handoffProposalId: proposal.id,
                  isHandoffProposal: true,
                },
              };
              turn.messages.push(proposalMsg);

              // STOP the loop -- user must approve/reject
              this.emitTrace(traceId, turn, activeAgent, turnTimer());
              return turn;
            }

            // Invalid handoff target -- inform the LLM and continue
            const errorResult: ToolResult = {
              success: false,
              output: '',
              error: `Cannot hand off to "${params['target_agent'] ?? 'unknown'}". Valid targets: ${agent.canHandoffTo.join(', ')}.`,
            };
            this.callbacks.onToolCallStart?.(toolCall);
            this.callbacks.onToolCallEnd?.(toolCall, errorResult);

            llmMessages.push(
              { role: 'assistant', content: `handoff_to_agent(${tc.function.arguments})` },
              { role: 'tool', content: JSON.stringify(errorResult), tool_call_id: toolCall.id },
            );
            continue;
          }

          // ---- Regular tool: execute inline ----
          this.callbacks.onToolCallStart?.(toolCall);
          const toolTimer = startTimer();
          const result = await this.toolExecutor.execute(toolCall.toolId, toolCall.parameters);
          captureToolCall({
            traceId,
            toolName: toolCall.toolId,
            toolParameters: toolCall.parameters,
            result: { success: result.success, output: result.output, error: result.error },
            durationMs: toolTimer(),
            agentType: activeAgent,
          });
          this.callbacks.onToolCallEnd?.(toolCall, result);

          // Record as conversation messages
          const toolCallMsg: Message = {
            id: nanoid(),
            conversationId,
            role: 'assistant',
            content: '',
            agentType: activeAgent,
            toolCall,
            timestamp: Date.now(),
          };
          const toolResultMsg: Message = {
            id: nanoid(),
            conversationId,
            role: 'tool',
            content: JSON.stringify(result.output),
            toolResult: result,
            timestamp: Date.now(),
          };
          turn.messages.push(toolCallMsg, toolResultMsg);

          // Feed back into LLM context
          llmMessages.push(
            { role: 'assistant', content: `${tc.function.name}(${tc.function.arguments})` },
            { role: 'tool', content: JSON.stringify(result), tool_call_id: toolCall.id },
          );
        }

        // Loop back for next LLM call
        continue;
      }

      // --- Final text response ---
      if (response.content) {
        turn.finalResponse = response.content;
        const assistantMsg: Message = {
          id: nanoid(),
          conversationId,
          role: 'assistant',
          content: response.content,
          agentType: activeAgent,
          timestamp: Date.now(),
        };
        turn.messages.push(assistantMsg);
        this.emitTrace(traceId, turn, activeAgent, turnTimer());
        return turn;
      }

      // Empty response
      break;
    }

    // Max iterations
    if (!turn.finalResponse) {
      turn.finalResponse =
        '[Agent reached maximum iterations without a final answer. Partial work is shown above.]';
      const warningMsg: Message = {
        id: nanoid(),
        conversationId,
        role: 'assistant',
        content: turn.finalResponse,
        agentType: activeAgent,
        timestamp: Date.now(),
        metadata: { maxIterationsReached: true },
      };
      turn.messages.push(warningMsg);
    }

    this.emitTrace(traceId, turn, activeAgent, turnTimer());
    return turn;
  }

  private emitTrace(
    traceId: string,
    turn: AgentTurn,
    agentType: AgentType,
    durationMs: number,
  ): void {
    captureTrace({
      traceId,
      agentType,
      durationMs,
      iterations: turn.iterations,
      toolCalls: turn.toolCalls,
      hasHandoff: !!turn.pendingHandoff,
      handoffTarget: turn.pendingHandoff?.toAgent,
      hasFinalResponse: !!turn.finalResponse,
    });
  }

  // -----------------------------------------------------------------------
  // Handoff resolution methods (called by the UI after user action)
  // -----------------------------------------------------------------------

  /**
   * User approved the handoff. Switch the active agent and return
   * the messages to inject into the conversation.
   * The caller should then call `runTurn()` with the new agent.
   */
  approveHandoff(
    proposal: HandoffProposal,
    conversationId: string,
  ): { newAgent: AgentType; messages: Message[] } {
    proposal.status = 'approved';
    const newAgent = proposal.toAgent;
    const messages = buildHandoffMessages(proposal, conversationId);
    return { newAgent, messages };
  }

  /**
   * User rejected the handoff. The current agent stays active.
   * Returns a system message informing the agent that the handoff was denied,
   * so it can adjust its approach.
   */
  rejectHandoff(
    proposal: HandoffProposal,
    conversationId: string,
  ): { messages: Message[] } {
    proposal.status = 'rejected';
    const rejectionMsg: Message = {
      id: nanoid(),
      conversationId,
      role: 'system',
      content: `[Handoff to ${getAgent(proposal.toAgent).name} was rejected by the user. Continue handling the request yourself.]`,
      agentType: proposal.fromAgent,
      timestamp: Date.now(),
      metadata: { handoffId: proposal.id, handoffRejected: true },
    };
    return { messages: [rejectionMsg] };
  }

  /**
   * User redirected the handoff to a different agent than proposed.
   * Returns the new target agent and messages to inject.
   */
  redirectHandoff(
    proposal: HandoffProposal,
    redirectTo: AgentType,
    conversationId: string,
  ): { newAgent: AgentType; messages: Message[] } {
    proposal.status = 'redirected';
    proposal.redirectedTo = redirectTo;
    const messages = buildHandoffMessages(proposal, conversationId);
    return { newAgent: redirectTo, messages };
  }

  /**
   * User manually switches the active agent (no handoff proposal needed).
   * Returns a context message for the new agent.
   */
  manualSwitch(
    fromAgent: AgentType,
    toAgent: AgentType,
    conversationId: string,
  ): { messages: Message[] } {
    const fromName = getAgent(fromAgent).name;
    const toName = getAgent(toAgent).name;
    const msg: Message = {
      id: nanoid(),
      conversationId,
      role: 'system',
      content: `[User switched from ${fromName} to ${toName}. You now have full access to the conversation history above.]`,
      agentType: toAgent,
      timestamp: Date.now(),
      metadata: { manualSwitch: true, switchFrom: fromAgent, switchTo: toAgent },
    };
    return { messages: [msg] };
  }

  // -----------------------------------------------------------------------
  // Static helper for initial routing
  // -----------------------------------------------------------------------

  /**
   * Use the keyword router to suggest an initial agent for a new conversation.
   * The UI can use this as a default but the user can override.
   */
  static suggestAgent(userMessage: string): AgentType {
    return routeMessage(userMessage).selectedAgent;
  }
}
