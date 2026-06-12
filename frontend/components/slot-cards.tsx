'use client';

import { useEffect, useState } from 'react';
import type { BookingView, Slot, TraceEvent } from '@voice-agent/shared';
import { traceRelay } from '@/lib/trace/relay';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Visual mirror of the conversation (US1): the slots the agent offered and the
 * booking it confirmed, derived from relayed checkAvailability / bookSlot events.
 */
export function SlotCards() {
  const [slots, setSlots] = useState<Slot[]>([]);
  const [booking, setBooking] = useState<BookingView | null>(null);

  useEffect(() => {
    const apply = (e: TraceEvent) => {
      if (e.type === 'tool_result' && e.name === 'checkAvailability') {
        const r = e.result as { slots?: Slot[] };
        if (r?.slots) setSlots(r.slots.slice(0, 6));
      }
      if (e.type === 'tool_result' && (e.name === 'bookSlot' || e.name === 'rescheduleBooking')) {
        const r = e.result as { booking?: BookingView };
        if (r?.booking) setBooking(r.booking);
      }
    };
    traceRelay.events.forEach(apply);
    return traceRelay.onEvent(apply);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Booking</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {booking && (
          <div className="rounded-md border border-primary/40 bg-secondary p-3 text-sm">
            <div className="flex items-center gap-2">
              <Badge>{booking.status}</Badge>
              <span className="font-medium">{booking.serviceName}</span>
            </div>
            <p className="mt-1">
              {fmt(booking.startTime)} · {booking.customerName} · {booking.contact}
            </p>
          </div>
        )}
        <div>
          <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
            Offered slots
          </p>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">No slots offered yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <Badge key={s.startTime} variant="outline">
                  {fmt(s.startTime)}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
