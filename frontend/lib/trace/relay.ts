'use client';

import { io, type Socket } from 'socket.io-client';
import type { RelayEvent, TraceEvent, TraceEventType } from '@voice-agent/shared';
import { BACKEND_URL } from '@/lib/config';

/**
 * Relays browser session events (tool calls, handoffs, guardrail trips) to the
 * NestJS /realtime gateway so it can assemble the inspectable trace (research D9).
 * The audio itself never flows through here — it's a direct browser↔OpenAI
 * WebRTC link; only events are relayed.
 */
class TraceRelay {
  private socket: Socket | null = null;
  private sessionId = '';
  private listeners = new Set<(e: TraceEvent) => void>();
  /** Local mirror so the trace panel renders even before server round-trips. */
  readonly events: TraceEvent[] = [];

  connect(sessionId: string) {
    this.sessionId = sessionId;
    this.events.length = 0;
    this.socket?.disconnect();
    this.socket = io(`${BACKEND_URL}/realtime`, { transports: ['websocket'] });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }

  onEvent(cb: (e: TraceEvent) => void): () => void {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  emit(
    type: TraceEventType,
    name: string,
    extra: Partial<Pick<RelayEvent, 'args' | 'result' | 'detail'>> = {},
  ) {
    const event: RelayEvent = {
      sessionId: this.sessionId,
      type,
      name,
      ts: new Date().toISOString(),
      ...extra,
    };
    const local: TraceEvent = { ...event, seq: this.events.length };
    this.events.push(local);
    this.listeners.forEach((cb) => cb(local));
    this.socket?.emit('event', event);
  }
}

export const traceRelay = new TraceRelay();
