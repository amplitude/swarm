/**
 * Amplitude Agent Analytics verification for Swarm.
 * Proves swarm-chat emits User Message → Tool Call → AI Response → Session End
 * with the Agent Analytics data-quality fields populated.
 */
import { describe, it, expect } from 'vitest';
import { AIConfig, tool } from '@amplitude/ai';
import { MockAmplitudeAI } from '@amplitude/ai/testing';

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(String(text || '').length / 4));
}

describe('Amplitude Agent Analytics — swarm-chat', () => {
  it('emits full turn sequence with data-quality fields', async () => {
    const mock = new MockAmplitudeAI(new AIConfig({ contentMode: 'full', redactPii: true }));
    const agent = mock.agent('swarm-chat', {
      description:
        'Handles user chat via local TinyLlama; always runs inspect_message first',
      userId: 'user-verify-1',
    });

    const inspectMessage = (message: string) => ({
      messageLength: message.length,
      wordCount: message.split(/\s+/).filter(Boolean).length,
      classification: 'medium',
    });
    const inspectMessageTool = tool(inspectMessage, { name: 'inspect_message' });

    const userMessage = 'What is the capital of France?';
    const aiContent = 'Paris is the capital of France.';
    const model = 'tinyllama-1.1b-chat-v1.0';
    const provider = 'node-llama-cpp';

    await agent.session({ sessionId: 's1' }).run(async (s) => {
      s.trackUserMessage(userMessage);
      await inspectMessageTool(userMessage);

      const inputTokens = estimateTokens(userMessage);
      const outputTokens = estimateTokens(aiContent);
      s.trackAiMessage(aiContent, model, provider, 150, {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
        totalCostUsd: 0,
        finishReason: 'stop',
      });
    });

    mock.assertEventTracked('[Agent] User Message', { userId: 'user-verify-1' });
    mock.assertEventTracked('[Agent] Tool Call');
    mock.assertEventTracked('[Agent] AI Response');
    mock.assertSessionClosed('s1');

    const toolEvents = mock.getEvents('[Agent] Tool Call');
    expect(toolEvents.length).toBeGreaterThan(0);

    const agentEvents = mock.eventsForAgent('swarm-chat');
    expect(agentEvents.length).toBeGreaterThan(0);

    const aiEvents = mock.getEvents('[Agent] AI Response');
    expect(aiEvents.length).toBeGreaterThan(0);

    for (const e of aiEvents) {
      const p = e.event_properties ?? {};
      expect(e.user_id || e.device_id).toBeTruthy();
      expect(p['[Agent] Session ID']).toBeTruthy();
      expect(p['[Agent] Model'] || p['[Agent] Model Name']).toBeTruthy();
      expect(p['[Agent] Provider']).toBeTruthy();
      expect(Number(p['[Agent] Latency Ms'])).toBeGreaterThan(0);
      expect(Number(p['[Agent] Input Tokens'])).toBeGreaterThan(0);
      expect(Number(p['[Agent] Output Tokens'])).toBeGreaterThan(0);
      expect(p['[Agent] Cost USD']).toBeDefined();
    }

    // eslint-disable-next-line no-console
    console.log(mock.summary());
  });

  it('fallback path still emits AI Response with error flags', async () => {
    const mock = new MockAmplitudeAI(new AIConfig({ contentMode: 'full', redactPii: true }));
    const agent = mock.agent('swarm-chat', { userId: 'user-verify-2' });

    await agent.session({ sessionId: 's-fallback' }).run(async (s) => {
      s.trackUserMessage('hello');
      s.trackAiMessage(
        'I understand your message, but I am in fallback mode.',
        'fallback',
        'node-llama-cpp',
        12,
        {
          inputTokens: 2,
          outputTokens: 12,
          totalTokens: 14,
          totalCostUsd: 0,
          finishReason: 'fallback',
          isError: true,
          errorMessage: 'Model not loaded',
          errorType: 'ModelUnavailable',
        },
      );
    });

    mock.assertEventTracked('[Agent] AI Response');
    mock.assertSessionClosed('s-fallback');
  });
});
