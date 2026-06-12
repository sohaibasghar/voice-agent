'use client';

import { RealtimeSession } from '@openai/agents-realtime';
import { frontDeskAgent } from '@/lib/agents/front-desk';
import { stayInDomainGuardrail } from '@/lib/guardrails/stay-in-domain';
import { createTransport } from '@/lib/transport/webrtc-transport';
import { traceRelay } from '@/lib/trace/relay';
import { BACKEND_URL, newSessionId } from '@/lib/config';

export type SessionStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface SessionHandle {
  sessionId: string;
  disconnect: () => Promise<void>;
}

interface StartOptions {
  modelTier?: 'dev' | 'live';
  onStatus?: (status: SessionStatus) => void;
  onInterrupted?: () => void;
}

/**
 * Starts a browser voice session: mint an ephemeral token from NestJS, open a
 * direct WebRTC RealtimeSession with the front-desk agent + guardrails, and
 * relay handoff events to the trace. The real API key never reaches the browser
 * (Constitution I) — only the short-lived ek_ token does.
 */
export async function startVoiceSession(opts: StartOptions = {}): Promise<SessionHandle> {
  const { modelTier, onStatus, onInterrupted } = opts;
  onStatus?.('connecting');

  const sessionId = newSessionId();
  traceRelay.connect(sessionId);

  // 1. Mint ephemeral token server-side.
  const res = await fetch(`${BACKEND_URL}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(modelTier ? { modelTier } : {}),
  });
  if (!res.ok) {
    onStatus?.('error');
    throw new Error(`Failed to mint session token (${res.status})`);
  }
  const { value, model } = (await res.json()) as { value: string; model: string };

  // 2. Open the realtime session over WebRTC.
  const session = new RealtimeSession(frontDeskAgent, {
    transport: createTransport(),
    model,
    outputGuardrails: [stayInDomainGuardrail],
    outputGuardrailSettings: { debounceTextLength: 100 },
  });

  // 3. Relay handoff events + surface barge-in / errors.
  session.on('agent_handoff', (_ctx, fromAgent, toAgent) => {
    traceRelay.emit('handoff', `${fromAgent?.name ?? '?'} → ${toAgent?.name ?? '?'}`, {
      detail: toAgent?.name,
    });
  });
  session.on('audio_interrupted', () => onInterrupted?.());
  session.on('error', (err) => {
    console.error('RealtimeSession error', err);
    onStatus?.('error');
  });

  await session.connect({ apiKey: value });
  onStatus?.('connected');

  return {
    sessionId,
    disconnect: async () => {
      try {
        session.close();
      } finally {
        traceRelay.disconnect();
        onStatus?.('idle');
      }
      await Promise.resolve();
    },
  };
}
