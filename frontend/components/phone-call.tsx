'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Mic, MicOff } from 'lucide-react';
import { voiceClient, type VoiceStatus } from '@/lib/voice-client';
import { Ringback } from '@/lib/ringtone';
import { agentMeta } from '@/lib/agents-meta';
import { cn } from '@/lib/utils';

function useCallTimer(active: boolean): string {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!active) { setSecs(0); return; }
    const id = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
  const mm = String(Math.floor(secs / 60)).padStart(2, '0');
  const ss = String(secs % 60).padStart(2, '0');
  return `${mm}:${ss}`;
}

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
          setTransferTo(agentMeta(name).label);
          setTimeout(() => setTransferTo(null), 2000);
        }
        return name;
      });
    });
    return () => { offStatus(); offInt(); offAgent(); };
  }, []);

  useEffect(() => {
    if (dialing) { ringback.current = new Ringback(); ringback.current.start(); }
    else { ringback.current?.stop(); ringback.current = null; }
    return () => { ringback.current?.stop(); ringback.current = null; };
  }, [dialing]);

  const call = useCallback(async () => {
    setError(null); setMuted(false); setAgent('FrontDeskAgent');
    try { await voiceClient.start(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Call failed'); }
  }, []);

  const hangup = useCallback(() => voiceClient.stop(), []);
  const toggleMute = useCallback(() => {
    const next = !voiceClient.isMuted;
    voiceClient.setMuted(next);
    setMuted(next);
  }, []);

  return (
    <div className="surface-accent relative flex flex-col items-center overflow-hidden px-6 py-8 text-center">
      {/* Subtle glow behind avatar */}
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-40 opacity-0 transition-opacity duration-700 blur-3xl',
          connected && 'opacity-30',
        )}
        style={{ background: 'radial-gradient(ellipse at 50% 0%, hsl(258 80% 55%), transparent 70%)' }}
      />

      {/* Label */}
      <div className="label mb-6 w-full text-left">Voice Session</div>

      {/* Avatar */}
      <div className="relative mb-5">
        {(dialing || (connected && speaking)) && (
          <>
            <span className="absolute inset-0 -m-2 animate-ping rounded-full border border-primary/30" />
            <span className="absolute inset-0 -m-5 animate-ping rounded-full border border-primary/15 [animation-delay:300ms]" />
          </>
        )}
        <div
          className={cn(
            'flex h-20 w-20 items-center justify-center rounded-full border-2 text-3xl transition-all duration-500',
            connected
              ? 'border-primary/50 bg-primary/10 shadow-[0_0_24px_hsl(258_80%_72%/0.2)]'
              : 'border-border bg-secondary',
          )}
        >
          {meta.emoji}
        </div>
        {connected && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-card bg-emerald-500">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-200" />
          </span>
        )}
      </div>

      {/* Agent + status */}
      <div className="mb-6">
        <h2 className="font-display text-2xl font-semibold text-foreground">
          Bloom Salon &amp; Spa
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {connected ? `${meta.label} · ${meta.role}` : 'Front Desk · Bookings & scheduling'}
        </p>
        <p
          className={cn(
            'mt-2 font-mono text-sm tabular-nums',
            error || status === 'error' ? 'text-destructive' : '',
            connected && !error ? 'text-primary' : '',
            !connected && !error ? 'text-muted-foreground' : '',
          )}
        >
          {error ?? (
            dialing ? 'Connecting…' :
            connected ? `${timer}${muted ? ' · MUTED' : ''}${speaking ? ' · LISTENING' : ''}` :
            'Ready'
          )}
        </p>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {!connected && !dialing && (
          <button
            onClick={call}
            className="flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-95"
          >
            <Phone className="h-4 w-4" />
            Call front desk
          </button>
        )}
        {dialing && (
          <button
            onClick={hangup}
            className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-5 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/15 active:scale-95"
          >
            <PhoneOff className="h-4 w-4 animate-pulse" />
            Cancel
          </button>
        )}
        {connected && (
          <>
            <button
              onClick={toggleMute}
              aria-label={muted ? 'Unmute' : 'Mute'}
              className={cn(
                'flex h-10 w-10 items-center justify-center rounded-md border text-sm transition active:scale-95',
                muted
                  ? 'border-amber-500/40 bg-amber-500/15 text-amber-400'
                  : 'border-border bg-secondary text-muted-foreground hover:text-foreground',
              )}
            >
              {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
            <button
              onClick={hangup}
              className="flex items-center gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-5 py-2.5 text-sm font-medium text-destructive transition hover:bg-destructive/15 active:scale-95"
            >
              <PhoneOff className="h-4 w-4" />
              End call
            </button>
          </>
        )}
      </div>

      {!connected && !dialing && (
        <p className="mt-4 max-w-[22ch] text-xs leading-relaxed text-muted-foreground/60">
          Allow mic access, then speak naturally. Cancel/reschedule requires approval.
        </p>
      )}

      {/* Handoff toast */}
      {transferTo && (
        <div className="animate-in fade-in slide-in-from-bottom-2 absolute inset-x-4 bottom-4 flex justify-center">
          <div className="rounded-md border border-primary/30 bg-card px-4 py-2 text-xs font-medium text-primary shadow-lg">
            Transferring to {transferTo}…
          </div>
        </div>
      )}
    </div>
  );
}
