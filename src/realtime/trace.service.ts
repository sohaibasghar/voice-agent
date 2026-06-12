import { Injectable } from '@nestjs/common';
import type { RelayEvent, TraceEvent } from '@voice-agent/shared';

/**
 * Assembles a per-session, ordered trace from relayed browser events
 * (research.md D9). This is the demo's inspectable trace: tool calls with
 * args/results, handoff branches, and guardrail trips, in order.
 */
@Injectable()
export class TraceService {
  private readonly sessions = new Map<string, TraceEvent[]>();

  append(event: RelayEvent): TraceEvent {
    const list = this.sessions.get(event.sessionId) ?? [];
    const traceEvent: TraceEvent = { ...event, seq: list.length };
    list.push(traceEvent);
    this.sessions.set(event.sessionId, list);
    return traceEvent;
  }

  snapshot(sessionId: string): TraceEvent[] {
    return this.sessions.get(sessionId) ?? [];
  }

  clear(sessionId: string): void {
    this.sessions.delete(sessionId);
  }
}
