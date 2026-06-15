import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';
import { RelayEventSchema, type RelayEvent } from 'voice-agent-shared';
import { TraceService } from './trace.service';

/**
 * WS /realtime — receives session events relayed from the browser (tool calls,
 * handoffs, guardrail trips) and assembles them into an inspectable per-session
 * trace (FR-015, research.md D9). The audio itself flows browser↔OpenAI over
 * WebRTC; only events are relayed here for the UI/trace.
 */
@WebSocketGateway({ namespace: '/realtime', cors: { origin: '*' } })
export class RealtimeGateway {
  private readonly logger = new Logger(RealtimeGateway.name);

  @WebSocketServer() server!: Server;

  @SubscribeMessage('event')
  handleEvent(
    @MessageBody() raw: unknown,
    @ConnectedSocket() client: Socket,
  ): { type: 'ack'; seq: number } | { type: 'error'; message: string } {
    const parsed = RelayEventSchema.safeParse(raw);
    if (!parsed.success) {
      return { type: 'error', message: 'invalid relay event' };
    }
    const event: RelayEvent = parsed.data;
    const traceEvent = this.trace.append(event);
    this.logger.debug(
      `relay ${event.type}:${event.name} (session ${event.sessionId})`,
    );
    // Broadcast to any UI listeners watching this session's trace.
    client.broadcast.emit('trace_event', traceEvent);
    return { type: 'ack', seq: traceEvent.seq };
  }

  @SubscribeMessage('trace_snapshot')
  handleSnapshot(@MessageBody() body: { sessionId: string }) {
    return {
      type: 'trace_snapshot',
      events: this.trace.snapshot(body?.sessionId),
    };
  }

  constructor(private readonly trace: TraceService) {}
}
