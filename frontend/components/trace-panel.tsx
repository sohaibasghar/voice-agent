'use client';

import { useEffect, useState } from 'react';
import type { TraceEvent } from 'voice-agent-shared';
import { voiceClient } from '@/lib/voice-client';
import { cn } from '@/lib/utils';

const TYPE_STYLE: Record<TraceEvent['type'], { label: string; cls: string }> = {
  tool_call: { label: 'tool call', cls: 'bg-sky-500/15 text-sky-300 border-sky-400/30' },
  tool_result: { label: 'result', cls: 'bg-white/5 text-white/60 border-white/15' },
  handoff: {
    label: 'handoff',
    cls: 'bg-violet-500/20 text-violet-200 border-violet-400/40',
  },
  guardrail_trip: {
    label: 'guardrail',
    cls: 'bg-rose-500/20 text-rose-200 border-rose-400/40',
  },
};

/**
 * The demo payoff (US4): an inspectable, ordered trace of every tool call with
 * args/results, handoff branches, and guardrail/approval events — forwarded from
 * the server-side session (also visible automatically in the hosted OpenAI trace
 * dashboard since the session runs in Node — research.md D3).
 */
export function TracePanel() {
  const [events, setEvents] = useState<TraceEvent[]>([...voiceClient.events]);

  useEffect(() => {
    setEvents([...voiceClient.events]);
    return voiceClient.on('event', (e) => setEvents((prev) => [...prev, e]));
  }, []);

  return (
    <div className="glass flex h-full flex-col p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-display text-lg font-semibold">Live Trace</h3>
        <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-white/60">
          {events.length} events
        </span>
      </div>
      <div className="space-y-2 overflow-auto pr-1" style={{ maxHeight: '70vh' }}>
        {events.length === 0 && (
          <p className="text-sm text-white/40">
            Tool calls, handoffs, and guardrail/approval events appear here as you talk.
          </p>
        )}
        {events.map((e) => {
          const style = TYPE_STYLE[e.type];
          return (
            <div
              key={e.seq}
              className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm"
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[11px] font-medium',
                    style.cls,
                  )}
                >
                  {style.label}
                </span>
                <span className="font-mono text-[13px] font-medium text-white/90">
                  {e.name}
                </span>
                <span className="ml-auto text-[11px] text-white/35">
                  {new Date(e.ts).toLocaleTimeString()}
                </span>
              </div>
              {e.detail && <p className="mt-1 text-xs text-white/45">{e.detail}</p>}
              {e.args !== undefined && (
                <pre className="mt-1 overflow-auto rounded-lg bg-black/30 p-2 text-[11px] text-white/70">
                  {JSON.stringify(e.args, null, 2)}
                </pre>
              )}
              {e.result !== undefined && (
                <pre className="mt-1 overflow-auto rounded-lg bg-black/30 p-2 text-[11px] text-white/70">
                  {JSON.stringify(e.result, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
