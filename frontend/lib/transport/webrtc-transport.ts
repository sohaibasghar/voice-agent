'use client';

import { OpenAIRealtimeWebRTC } from '@openai/agents-realtime';

/**
 * Audio transport seam (research.md D12, PRD §16). The browser uses WebRTC for
 * a direct, low-latency media link to OpenAI. Isolating creation here means a
 * future Twilio Media Streams transport can be swapped in without touching the
 * agents, tools, or guardrails.
 */
export function createTransport(): OpenAIRealtimeWebRTC {
  return new OpenAIRealtimeWebRTC();
}
