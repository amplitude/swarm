/**
 * Amplitude Agent Analytics bootstrap for Swarm.
 */
import { AmplitudeAI, AIConfig } from '@amplitude/ai';

export const ai = new AmplitudeAI({
  apiKey: process.env.AMPLITUDE_AI_API_KEY || '',
  config: new AIConfig({
    contentMode: 'full',
    redactPii: true,
  }),
});

export const swarmAgent = ai.agent('swarm-chat', {
  description:
    'Handles user chat via local TinyLlama; always runs inspect_message first',
});
