'use client';

import type { RealtimeOutputGuardrail } from '@openai/agents-realtime';
import { traceRelay } from '@/lib/trace/relay';

const OFF_TOPIC = [
  'weather',
  'stock',
  'politics',
  'joke',
  'recipe',
  'sports score',
];

/**
 * Stay-in-domain output guardrail (Constitution III, FR-013). Trips if the
 * agent drifts well outside salon front-desk topics, nudging it back to
 * booking/FAQ. The hard guarantees (no-double-book, confirm-before-destructive)
 * are enforced server-side, not here — this is a soft conversational guard.
 */
export const stayInDomainGuardrail: RealtimeOutputGuardrail = {
  name: 'stay_in_domain',
  policyHint:
    'Only help with salon/spa bookings, rescheduling, cancellations, services, pricing, and FAQs. Politely steer other topics back to booking.',
  async execute({ agentOutput }) {
    const text = typeof agentOutput === 'string' ? agentOutput.toLowerCase() : '';
    const tripwireTriggered = OFF_TOPIC.some((w) => text.includes(w));
    if (tripwireTriggered) {
      traceRelay.emit('guardrail_trip', 'stay_in_domain', {
        detail: 'off-topic response deflected',
      });
    }
    return { tripwireTriggered, outputInfo: {} };
  },
};
