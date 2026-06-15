'use client';

import { useEffect, useState } from 'react';
import type { BookingView, Slot, TraceEvent } from 'voice-agent-shared';
import { voiceClient } from '@/lib/voice-client';

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Visual mirror of the conversation (US1): the slots the agent offered and the
 * booking it confirmed, derived from forwarded checkAvailability / bookSlot events.
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
      if (
        e.type === 'tool_result' &&
        (e.name === 'bookSlot' || e.name === 'rescheduleBooking')
      ) {
        const r = e.result as { booking?: BookingView };
        if (r?.booking) setBooking(r.booking);
      }
    };
    voiceClient.events.forEach(apply);
    return voiceClient.on('event', apply);
  }, []);

  if (slots.length === 0 && !booking) return null;

  return (
    <div className="glass p-6">
      <h3 className="mb-3 font-display text-lg font-semibold">Booking</h3>
      <div className="space-y-3">
        {booking && (
          <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 p-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-500/80 px-2 py-0.5 text-[11px] font-semibold text-white">
                {booking.status}
              </span>
              <span className="font-medium text-white/90">{booking.serviceName}</span>
            </div>
            <p className="mt-1 text-white/70">
              {fmt(booking.startTime)} · {booking.customerName} · {booking.contact}
            </p>
          </div>
        )}
        {slots.length > 0 && (
          <div>
            <p className="mb-2 text-xs uppercase tracking-wide text-white/40">
              Offered slots
            </p>
            <div className="flex flex-wrap gap-2">
              {slots.map((s) => (
                <span
                  key={s.startTime}
                  className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-sm text-white/80"
                >
                  {fmt(s.startTime)}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
