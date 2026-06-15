'use client';

import { useEffect, useState } from 'react';
import type { BookingView, Slot, TraceEvent } from 'voice-agent-shared';
import { voiceClient } from '@/lib/voice-client';

function fmt(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

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
    voiceClient.events.forEach(apply);
    return voiceClient.on('event', apply);
  }, []);

  if (!slots.length && !booking) return null;

  return (
    <div className="surface overflow-hidden">
      {booking && (
        <div className="border-b border-border p-5">
          <div className="label mb-2">Confirmed booking</div>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-xl font-semibold text-foreground">{booking.serviceName}</p>
              <p className="mt-0.5 font-mono text-sm text-primary">{fmt(booking.startTime)}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">{booking.customerName} · {booking.contact}</p>
            </div>
            <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-2 py-1 font-mono text-[10px] font-medium uppercase tracking-wide text-emerald-400">
              {booking.status}
            </span>
          </div>
        </div>
      )}
      {slots.length > 0 && (
        <div className="p-5">
          <div className="label mb-3">Available slots</div>
          <div className="flex flex-wrap gap-2">
            {slots.map((s) => (
              <span
                key={s.startTime}
                className="rounded border border-border bg-secondary px-3 py-1.5 font-mono text-[11px] text-muted-foreground hover:border-primary/30 hover:text-primary transition-colors"
              >
                {fmt(s.startTime)}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
