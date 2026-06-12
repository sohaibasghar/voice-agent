'use client';

import { useEffect, useState } from 'react';
import type { TraceEvent } from '@voice-agent/shared';
import { traceRelay } from '@/lib/trace/relay';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const TYPE_STYLE: Record<TraceEvent['type'], { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  tool_call: { label: 'tool call', variant: 'secondary' },
  tool_result: { label: 'result', variant: 'outline' },
  handoff: { label: 'handoff', variant: 'default' },
  guardrail_trip: { label: 'guardrail', variant: 'destructive' },
};

/**
 * The demo payoff (US4): an inspectable, ordered trace of every tool call with
 * args/results, handoff branches, and guardrail trips — assembled from relayed
 * session events (research.md D9).
 */
export function TracePanel() {
  const [events, setEvents] = useState<TraceEvent[]>([...traceRelay.events]);

  useEffect(() => {
    setEvents([...traceRelay.events]);
    return traceRelay.onEvent((e) => setEvents((prev) => [...prev, e]));
  }, []);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Trace</span>
          <Badge variant="outline">{events.length} events</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 overflow-auto max-h-[60vh]">
        {events.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Tool calls, handoffs, and guardrail trips will appear here as you talk.
          </p>
        )}
        {events.map((e) => {
          const style = TYPE_STYLE[e.type];
          return (
            <div key={e.seq} className="rounded-md border p-3 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant={style.variant}>{style.label}</Badge>
                <span className="font-mono font-medium">{e.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {new Date(e.ts).toLocaleTimeString()}
                </span>
              </div>
              {e.detail && <p className="mt-1 text-xs text-muted-foreground">{e.detail}</p>}
              {e.args !== undefined && (
                <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(e.args, null, 2)}
                </pre>
              )}
              {e.result !== undefined && (
                <pre className="mt-1 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(e.result, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
