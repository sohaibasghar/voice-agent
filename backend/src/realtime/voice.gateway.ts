import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Socket } from 'socket.io';
import {
  OpenAIRealtimeWebSocket,
  RealtimeSession,
  type RealtimeAgent,
} from '@openai/agents-realtime';
import type { RunToolApprovalItem } from '@openai/agents-core';
import type { RelayEvent, TraceEventType } from 'voice-agent-shared';
import { VoiceAgentsService } from './voice-agents.service';
import { TraceService } from './trace.service';

const MODEL_BY_TIER: Record<string, string> = {
  dev: 'gpt-realtime-mini',
  live: 'gpt-realtime-2',
};

interface VoiceConn {
  session: RealtimeSession;
  sessionId: string;
  approvals: Map<string, RunToolApprovalItem>;
}

/**
 * WS /voice — runs the OpenAI Agents SDK RealtimeSession SERVER-SIDE (research D3).
 * The browser streams mic PCM16 here; we feed session.sendAudio() and stream
 * session audio back. Tools execute in-process via the injected providers, output
 * guardrails + handoffs run here, and destructive tools pause for human approval.
 * Tracing is automatic (Node runtime) → hosted OpenAI dashboard.
 */
@WebSocketGateway({ namespace: '/voice', cors: { origin: '*' } })
export class VoiceGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(VoiceGateway.name);
  private readonly conns = new Map<string, VoiceConn>();

  constructor(
    private readonly agents: VoiceAgentsService,
    private readonly trace: TraceService,
    private readonly config: ConfigService,
  ) {}

  private resolveModel(tier?: string): string {
    const t = tier ?? this.config.get<string>('MODEL_TIER', 'dev');
    return MODEL_BY_TIER[t] ?? MODEL_BY_TIER.dev;
  }

  @SubscribeMessage('start')
  async start(
    @MessageBody()
    body: { sessionId: string; modelTier?: 'dev' | 'live' } | undefined,
    @ConnectedSocket() client: Socket,
  ): Promise<{ ok: boolean; model?: string; error?: string }> {
    const apiKey = this.config.get<string>('OPENAI_API_KEY');
    if (!apiKey || apiKey.startsWith('sk-REPLACE')) {
      return { ok: false, error: 'OPENAI_API_KEY not configured' };
    }
    if (this.conns.has(client.id)) return { ok: true };

    const sessionId = body?.sessionId ?? client.id;
    const model = this.resolveModel(body?.modelTier);
    const relay = (
      type: TraceEventType,
      name: string,
      extra: Partial<RelayEvent> = {},
    ) => {
      const event: RelayEvent = {
        sessionId,
        type,
        name,
        ts: new Date().toISOString(),
        ...extra,
      };
      const stored = this.trace.append(event);
      client.emit('event', stored);
    };

    const triage = this.agents.buildTriageAgent();
    const session = new RealtimeSession(triage as RealtimeAgent, {
      transport: new OpenAIRealtimeWebSocket({ useInsecureApiKey: true }),
      model,
      outputGuardrails: [this.agents.stayInDomainGuardrail],
      outputGuardrailSettings: { debounceTextLength: 100 },
    });

    const conn: VoiceConn = { session, sessionId, approvals: new Map() };
    this.conns.set(client.id, conn);

    // Audio out → browser. Track audio arrival so we can nudge a response after
    // a handoff if the new agent stays silent.
    let audioSeen = false;
    session.on('audio', (evt) => {
      audioSeen = true;
      client.emit('audio', Buffer.from(evt.data));
    });
    session.on('audio_interrupted', () => client.emit('interrupted'));

    // Active-agent tracking for the real-time handoff UI.
    const emitActive = (name?: string) =>
      client.emit('active_agent', { name: name ?? 'FrontDeskAgent' });
    emitActive('FrontDeskAgent');
    session.on('agent_start', (_c, agent) => emitActive(agent?.name));

    // Trace relay.
    session.on('agent_tool_start', (_c, _a, tool, details) =>
      relay('tool_call', tool.name, {
        args: safeArgs(
          (details?.toolCall as { arguments?: unknown })?.arguments,
        ),
      }),
    );
    session.on('agent_tool_end', (_c, _a, tool, result) =>
      relay('tool_result', tool.name, { result: safeJson(result) }),
    );
    session.on('agent_handoff', (_c, from, to) => {
      relay('handoff', `${from?.name ?? '?'} → ${to?.name ?? '?'}`, {
        detail: to?.name,
      });
      emitActive(to?.name);
      // After a transfer the SDK auto-requests a response, but if the new agent
      // stays silent (slow/dropped), nudge it so it always greets/continues.
      audioSeen = false;
      setTimeout(() => {
        if (!audioSeen && this.conns.has(client.id)) {
          try {
            session.transport.sendEvent({ type: 'response.create' });
          } catch (e) {
            this.logger.warn(`post-handoff nudge failed: ${String(e)}`);
          }
        }
      }, 1500);
    });
    session.on('guardrail_tripped', (_c, _a, details) =>
      relay('guardrail_trip', 'stay_in_domain', {
        detail: JSON.stringify(details ?? {}),
      }),
    );

    // Human-in-the-loop: pause destructive tools for approval.
    session.on('tool_approval_requested', (_c, _a, request) => {
      const item = request.approvalItem;
      const callId = approvalKey(item);
      conn.approvals.set(callId, item);
      relay('guardrail_trip', `approval:${rawName(item)}`, {
        detail: 'awaiting human approval',
        args: safeArgs(rawArgs(item)),
      });
      client.emit('approval_request', {
        callId,
        tool: rawName(item),
        args: safeArgs(rawArgs(item)),
      });
    });

    session.on('error', (err) => {
      this.logger.error(`session error: ${JSON.stringify(err)}`);
      client.emit('session_error', { message: 'session error' });
    });

    try {
      await session.connect({ apiKey });
      // Make the agent speak first: trigger an opening response so it greets the
      // caller (per the FrontDeskAgent instructions) without waiting for speech.
      // Fire-and-forget after a short settle so it never blocks/breaks the ack.
      setTimeout(() => {
        try {
          session.transport.sendEvent({ type: 'response.create' });
        } catch (e) {
          this.logger.warn(`greeting trigger failed: ${String(e)}`);
        }
      }, 250);
      return { ok: true, model };
    } catch (err) {
      this.conns.delete(client.id);
      this.logger.error(`connect failed: ${String(err)}`);
      return { ok: false, error: 'connect_failed' };
    }
  }

  /** Mic audio frame from the browser (PCM16 mono 24kHz) → into the session. */
  @SubscribeMessage('audio')
  onAudio(
    @MessageBody() data: ArrayBuffer | Buffer,
    @ConnectedSocket() client: Socket,
  ): void {
    const conn = this.conns.get(client.id);
    if (!conn) return;
    const buf = Buffer.isBuffer(data) ? toArrayBuffer(data) : data;
    conn.session.sendAudio(buf);
  }

  /** Caller started talking over the agent → barge-in. */
  @SubscribeMessage('interrupt')
  onInterrupt(@ConnectedSocket() client: Socket): void {
    this.conns.get(client.id)?.session.interrupt();
  }

  @SubscribeMessage('approve')
  async onApprove(
    @MessageBody() body: { callId: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const conn = this.conns.get(client.id);
    const item = conn?.approvals.get(body?.callId);
    if (conn && item) {
      await conn.session.approve(item);
      conn.approvals.delete(body.callId);
    }
  }

  @SubscribeMessage('reject')
  async onReject(
    @MessageBody() body: { callId: string; message?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const conn = this.conns.get(client.id);
    const item = conn?.approvals.get(body?.callId);
    if (conn && item) {
      await conn.session.reject(item, { message: body?.message });
      conn.approvals.delete(body.callId);
    }
  }

  handleDisconnect(client: Socket): void {
    const conn = this.conns.get(client.id);
    if (conn) {
      try {
        conn.session.close();
      } catch {
        /* ignore */
      }
      this.conns.delete(client.id);
    }
  }
}

// ── helpers ──────────────────────────────────────────────────────────────────

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(
    buf.byteOffset,
    buf.byteOffset + buf.byteLength,
  ) as ArrayBuffer;
}

function safeArgs(raw: unknown): unknown {
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

function safeJson(raw: unknown): unknown {
  return safeArgs(raw);
}

function approvalKey(item: RunToolApprovalItem): string {
  const raw = (item as { rawItem?: { callId?: string; id?: string } }).rawItem;
  return raw?.callId ?? raw?.id ?? Math.random().toString(36).slice(2);
}

function rawName(item: RunToolApprovalItem): string {
  return (item as { rawItem?: { name?: string } }).rawItem?.name ?? 'tool';
}

function rawArgs(item: RunToolApprovalItem): unknown {
  return (item as { rawItem?: { arguments?: unknown } }).rawItem?.arguments;
}
