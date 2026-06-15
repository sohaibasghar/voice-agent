'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { voiceClient, type VoiceStatus } from '@/lib/voice-client';
import { Ringback } from '@/lib/ringtone';
import { agentMeta } from '@/lib/agents-meta';
import { cn } from '@/lib/utils';

const BUSINESS_NAME = 'Bloom Salon & Spa';

function useCallTimer(active: boolean): string {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) {
      setSecs(0);
      return;
    }
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

/**
 * Premium phone-call experience for the realtime voice session: dial → ringing →
 * live call, with a call timer, talking/barge-in indicator, mute, hang-up, and a
 * real-time handoff display that shows which specialist is currently on the line.
 */
export function PhoneCall() {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [muted, setMuted] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agent, setAgent] = useState('FrontDeskAgent');
  const [transferTo, setTransferTo] = useState<string | null>(null);
  const ringback = useRef<Ringback | null>(null);

  const connected = status === 'connected';
  const dialing = status === 'connecting';
  const timer = useCallTimer(connected);
  const meta = agentMeta(agent);

  useEffect(() => {
    const offStatus = voiceClient.on('status', setStatus);
    const offInt = voiceClient.on('interrupted', () => {
      setSpeaking(true);
      setTimeout(() => setSpeaking(false), 700);
    });
    const offAgent = voiceClient.on('agent', (name) => {
      setAgent((prev) => {
        if (name !== prev) {
          // Brief "transferring" flourish on a real handoff.
          setTransferTo(agentMeta(name).label);
          setTimeout(() => setTransferTo(null), 1800);
        }
        return name;
      });
    });
    return () => {
      offStatus();
      offInt();
      offAgent();
    };
  }, []);

  useEffect(() => {
    if (dialing) {
      ringback.current = new Ringback();
      ringback.current.start();
    } else {
      ringback.current?.stop();
      ringback.current = null;
    }
    return () => {
      ringback.current?.stop();
      ringback.current = null;
    };
  }, [dialing]);

  const call = useCallback(async () => {
    setError(null);
    setMuted(false);
    setAgent('FrontDeskAgent');
    try {
      await voiceClient.start();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Call failed');
    }
  }, []);

  const hangup = useCallback(() => voiceClient.stop(), []);
  const toggleMute = useCallback(() => {
    const next = !voiceClient.isMuted;
    voiceClient.setMuted(next);
    setMuted(next);
  }, []);

  const statusLine = error
    ? error
    : dialing
      ? 'Calling…'
      : connected
        ? `In call · ${timer}`
        : status === 'error'
          ? 'Call failed'
          : 'Tap to call the front desk';

  return (
    <div className="glass relative overflow-hidden px-8 py-12">
      {/* ambient glow */}
      <div
        className={cn(
          'pointer-events-none absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-gradient-to-br opacity-30 blur-3xl transition-all duration-700',
          meta.accent,
        )}
      />

      <div className="relative flex flex-col items-center gap-7">
        {/* Avatar with ringing / speaking halo */}
        <div className="relative flex h-32 w-32 items-center justify-center">
          {(dialing || (connected && speaking)) && (
            <>
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/20" />
              <span className="absolute inline-flex h-[118%] w-[118%] animate-ping rounded-full bg-white/10 [animation-delay:300ms]" />
            </>
          )}
          <div
            className={cn(
              'relative flex h-28 w-28 items-center justify-center rounded-full bg-gradient-to-br text-4xl shadow-xl transition-all duration-500',
              meta.accent,
              connected && `ring-4 ${meta.ring}`,
            )}
          >
            {meta.emoji}
          </div>
        </div>

        {/* Active agent / business */}
        <div className="text-center">
          <h2 className="font-display text-2xl font-semibold tracking-tight">
            {BUSINESS_NAME}
          </h2>
          <div className="mt-1 flex flex-col items-center gap-1">
            {connected ? (
              <span className="text-sm font-medium text-white/90">
                {meta.label} <span className="text-white/40">·</span>{' '}
                <span className="text-white/55">{meta.role}</span>
              </span>
            ) : null}
            <p
              className={cn(
                'text-sm',
                error || status === 'error' ? 'text-red-400' : 'text-white/55',
                connected && 'tabular-nums text-emerald-300/90',
              )}
            >
              {statusLine}
              {connected && muted ? ' · muted' : ''}
              {connected && speaking ? ' · listening' : ''}
            </p>
          </div>
        </div>

        {/* Controls */}
        <div className="mt-1 flex items-center gap-6">
          {!connected && !dialing && (
            <button
              onClick={call}
              aria-label="Call"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-lg shadow-emerald-500/30 transition hover:bg-emerald-400 active:scale-95"
            >
              <Phone className="h-7 w-7" />
            </button>
          )}
          {dialing && (
            <button
              onClick={hangup}
              aria-label="Cancel call"
              className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg transition hover:bg-red-400 active:scale-95"
            >
              <PhoneOff className="h-7 w-7 animate-pulse" />
            </button>
          )}
          {connected && (
            <>
              <button
                onClick={toggleMute}
                aria-label={muted ? 'Unmute' : 'Mute'}
                className={cn(
                  'flex h-14 w-14 items-center justify-center rounded-full transition active:scale-95',
                  muted
                    ? 'bg-amber-500 text-white'
                    : 'bg-white/10 text-white hover:bg-white/20',
                )}
              >
                {muted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </button>
              <button
                onClick={hangup}
                aria-label="Hang up"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500 text-white shadow-lg shadow-red-500/30 transition hover:bg-red-400 active:scale-95"
              >
                <PhoneOff className="h-7 w-7" />
              </button>
            </>
          )}
        </div>

        <p className="max-w-xs text-center text-xs text-white/40">
          Allow the microphone, then speak naturally — e.g. “I&apos;d like a haircut
          Thursday afternoon.” Interrupt any time. Cancel/reschedule pauses for your
          approval.
        </p>
      </div>

      {/* Real-time handoff toast */}
      {transferTo && (
        <div className="absolute inset-x-0 bottom-4 flex justify-center">
          <div className="animate-in fade-in slide-in-from-bottom-2 rounded-full border border-white/15 bg-black/50 px-4 py-2 text-xs font-medium text-white/90 backdrop-blur">
            Transferring you to {transferTo}…
          </div>
        </div>
      )}
    </div>
  );
}
