'use client';

import { io, type Socket } from 'socket.io-client';
import type { TraceEvent } from 'voice-agent-shared';
import { BACKEND_URL, newSessionId } from '@/lib/config';
import { AudioEngine } from '@/lib/audio';
import { HoldMusic } from '@/lib/holdmusic';

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error';

export interface ApprovalRequest {
  callId: string;
  tool: string;
  args: unknown;
}

type Listeners = {
  status: (s: VoiceStatus) => void;
  event: (e: TraceEvent) => void;
  approval: (a: ApprovalRequest) => void;
  approvalResolved: (callId: string) => void;
  interrupted: () => void;
  agent: (name: string) => void;
};

/**
 * Thin client for the server-side realtime topology. Streams mic PCM16 to the
 * NestJS /voice gateway and plays back the agent audio it forwards. The OpenAI
 * Agents SDK runs entirely server-side; this client carries audio + UI events.
 */
class VoiceClient {
  private socket: Socket | null = null;
  private audio: AudioEngine | null = null;
  private hold: HoldMusic | null = null;
  private awaitingAgentAudio = false;
  private sessionId = '';
  private pending: Int16Array[] = [];
  private pendingLen = 0;
  private muted = false;
  private agentSpeaking = false;
  private playbackEndsAt = 0; // performance.now() ms when queued audio finishes
  private speakingTimer: ReturnType<typeof setTimeout> | null = null;
  private _status: VoiceStatus = 'idle';
  private _agent = 'FrontDeskAgent';
  readonly events: TraceEvent[] = [];

  get status(): VoiceStatus {
    return this._status;
  }
  get activeAgent(): string {
    return this._agent;
  }
  get isMuted(): boolean {
    return this.muted;
  }
  setMuted(m: boolean): void {
    this.muted = m;
  }
  private listeners: { [K in keyof Listeners]: Set<Listeners[K]> } = {
    status: new Set(),
    event: new Set(),
    approval: new Set(),
    approvalResolved: new Set(),
    interrupted: new Set(),
    agent: new Set(),
  };

  on<K extends keyof Listeners>(type: K, cb: Listeners[K]): () => void {
    this.listeners[type].add(cb);
    return () => this.listeners[type].delete(cb);
  }
  private emit<K extends keyof Listeners>(type: K, ...args: Parameters<Listeners[K]>) {
    this.listeners[type].forEach((cb) => (cb as (...a: unknown[]) => void)(...args));
  }
  private setStatus(s: VoiceStatus) {
    this._status = s;
    this.emit('status', s);
  }

  /**
   * Mark the agent as speaking and keep the mic gated until the audio actually
   * finishes PLAYING. The model streams faster than real time, so chunks arrive
   * in a burst while playback continues for seconds — we must track the true
   * playback end (sum of chunk durations), not chunk-arrival time, or the mic
   * re-opens mid-speech and the agent hears itself.
   */
  private markAgentAudio(byteLength: number) {
    const now = performance.now();
    const durationMs = (byteLength / 2 / 24000) * 1000; // PCM16 mono @24kHz
    this.playbackEndsAt = Math.max(this.playbackEndsAt, now) + durationMs;
    this.agentSpeaking = true;
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
    const tail = 300; // ms after playback ends before re-opening the mic
    this.speakingTimer = setTimeout(
      () => {
        this.agentSpeaking = false;
        this.speakingTimer = null;
      },
      this.playbackEndsAt - now + tail,
    );
  }

  async start(modelTier?: 'dev' | 'live'): Promise<void> {
    this.setStatus('connecting');
    this.sessionId = newSessionId();
    this.events.length = 0;
    this._agent = 'FrontDeskAgent';

    this.socket = io(`${BACKEND_URL}/voice`, { transports: ['websocket'] });
    this.socket.on('audio', (data: ArrayBuffer) => {
      // Half-duplex: while the agent is speaking, suppress the mic so it can't
      // hear (and respond to) its own voice through the speakers.
      this.markAgentAudio(data.byteLength);
      // The new agent is speaking → transfer complete. Keep hold music going a
      // beat longer so it covers the player's prebuffer (no silent gap).
      if (this.awaitingAgentAudio) {
        this.awaitingAgentAudio = false;
        const hold = this.hold;
        this.hold = null;
        setTimeout(() => hold?.stop(), 220);
      }
      this.audio?.playChunk(data);
    });
    this.socket.on('interrupted', () => {
      this.audio?.stopPlayback();
      this.emit('interrupted');
    });
    this.socket.on('event', (e: TraceEvent) => {
      this.events.push(e);
      this.emit('event', e);
    });
    this.socket.on('approval_request', (a: ApprovalRequest) => this.emit('approval', a));
    this.socket.on('active_agent', (a: { name: string }) => {
      const name = a?.name ?? 'FrontDeskAgent';
      const isTransfer = this._status === 'connected' && name !== this._agent;
      this._agent = name;
      if (isTransfer) {
        // Play hold music until the new agent's first audio arrives.
        this.audio?.stopPlayback();
        this.hold?.stop();
        this.hold = new HoldMusic();
        this.hold.start();
        this.awaitingAgentAudio = true;
        // Safety: never let hold music run forever if no audio follows.
        setTimeout(() => {
          if (this.awaitingAgentAudio) {
            this.awaitingAgentAudio = false;
            this.hold?.stop();
            this.hold = null;
          }
        }, 8000);
      }
      this.emit('agent', name);
    });
    this.socket.on('session_error', () => this.setStatus('error'));

    await new Promise<void>((resolve) => this.socket!.on('connect', () => resolve()));

    const ack = await this.socket
      .timeout(20000)
      .emitWithAck('start', { sessionId: this.sessionId, modelTier })
      .catch(() => ({ ok: false }) as { ok: boolean });
    if (!ack?.ok) {
      this.setStatus('error');
      await this.stop();
      throw new Error('Failed to start session');
    }

    this.audio = new AudioEngine();
    await this.audio.startCapture((frame) => this.queueAudio(frame));
    this.setStatus('connected');
  }

  /** Batch ~100ms of PCM16 before sending to reduce socket chatter. */
  private queueAudio(frame: ArrayBuffer) {
    // Suppress mic while muted, while the agent is speaking, or during a
    // transfer (hold music) — all echo/self-trigger guards.
    if (this.muted || this.agentSpeaking || this.awaitingAgentAudio) return;
    this.pending.push(new Int16Array(frame));
    this.pendingLen += frame.byteLength / 2;
    if (this.pendingLen >= 2400) {
      const merged = new Int16Array(this.pendingLen);
      let off = 0;
      for (const f of this.pending) {
        merged.set(f, off);
        off += f.length;
      }
      this.pending = [];
      this.pendingLen = 0;
      this.socket?.emit('audio', merged.buffer);
    }
  }

  interrupt() {
    this.socket?.emit('interrupt');
    this.audio?.stopPlayback();
  }

  approve(callId: string) {
    this.socket?.emit('approve', { callId });
    this.emit('approvalResolved', callId);
  }

  reject(callId: string, message?: string) {
    this.socket?.emit('reject', { callId, message });
    this.emit('approvalResolved', callId);
  }

  async stop() {
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
    this.speakingTimer = null;
    this.agentSpeaking = false;
    this.hold?.stop();
    this.hold = null;
    this.awaitingAgentAudio = false;
    await this.audio?.close();
    this.audio = null;
    this.socket?.disconnect();
    this.socket = null;
    this.setStatus('idle');
  }
}

export const voiceClient = new VoiceClient();
