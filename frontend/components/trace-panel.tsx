'use client';

import { useEffect, useState } from 'react';
import type { TraceEvent } from 'voice-agent-shared';
import { voiceClient } from '@/lib/voice-client';
import { cn } from '@/lib/utils';

const TYPE: Record<TraceEvent['type'], { label: string; cls: string }> = {
  tool_call:     { label: 'tool',      cls: 'bg-sky-500/10 text-sky-400 border-sky-500/20' },
  tool_result:   { label: 'result',    cls: 'bg-secondary text-muted-foreground border-border' },
  handoff:       { label: 'handoff',   cls: 'bg-primary/10 text-primary border-primary/20' },
  guardrail_trip:{ label: 'guardrail', cls: 'bg-destructive/10 text-destructive border-destructive/20' },
};

export function TracePanel() {
  const [events, setEvents] = useState<TraceEvent[]>([...voiceClient.events]);

  useEffect(() => {
    setEvents([...voiceClient.events]);
    return voiceClient.on('event', (e) => setEvents((prev) => [...prev, e]));
  }, []);

  return (
    <div className="surface overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
        <div className="flex items-center gap-3">
          <h3 className="font-display text-lg font-semibold text-foreground">Live Trace</h3>
          <span className="label">Agent execution log</span>
        </div>
        {events.length > 0 && (
          <span className="rounded border border-border bg-secondary px-2 py-0.5 font-mono text-xs text-muted-foreground">
            {events.length}
          </span>
        )}
      </div>

      {/* Events */}
      <div className="overflow-auto" style={{ maxHeight: '55vh' }}>
        {events.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <div className="flex gap-1">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-1.5 w-1.5 rounded-full bg-border" />
              ))}
            </div>
            <p className="text-sm text-muted-foreground">
              Tool calls, handoffs, and guardrail events appear here as you talk.
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {events.map((e, idx) => {
                const t = TYPE[e.type];
                return (
                  <tr
                    key={e.seq}
                    className={cn(
                      'group border-b border-border transition-colors hover:bg-secondary/50',
                      idx === events.length - 1 && 'border-b-0',
                    )}
                  >
                    {/* Time */}
                    <td className="w-20 px-5 py-3 font-mono text-[11px] tabular-nums text-muted-foreground/60">
                      {new Date(e.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                    </td>

                    {/* Type badge */}
                    <td className="w-24 py-3 pr-4">
                      <span className={cn('rounded border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wide', t.cls)}>
                        {t.label}
                      </span>
                    </td>

                    {/* Name */}
                    <td className="py-3 pr-4">
                      <span className="font-mono text-[13px] font-medium text-foreground">{e.name}</span>
                      {e.detail && <span className="ml-2 text-xs text-muted-foreground">{e.detail}</span>}
                    </td>

                    {/* Args / result collapsible */}
                    <td className="w-1/3 py-3 pr-5">
                      {(e.args !== undefined || e.result !== undefined) && (
                        <pre className="overflow-auto rounded border border-border bg-muted/40 p-2 font-mono text-[10px] leading-relaxed text-muted-foreground">
                          {JSON.stringify(e.result ?? e.args, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
