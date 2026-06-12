'use client';

import { tool } from '@openai/agents-realtime';
import {
  CancelBookingInput,
  LookupBookingInput,
  RescheduleBookingInput,
} from '@voice-agent/shared';
import { callTool } from './proxy';

/** US2 tools — lookup + confirm-gated reschedule/cancel. */

export const lookupBookingTool = tool({
  name: 'lookupBooking',
  description:
    'Find a caller existing booking by their name and phone contact. If more than one matches, ask a clarifying question before acting.',
  parameters: LookupBookingInput,
  execute: (input) => callTool('lookupBooking', input),
});

export const rescheduleBookingTool = tool({
  name: 'rescheduleBooking',
  description:
    'Move a booking to a new ISO start time. Set confirmed=true ONLY after the caller explicitly confirms the change in this turn. The backend rejects unconfirmed or conflicting moves.',
  parameters: RescheduleBookingInput,
  execute: (input) => callTool('rescheduleBooking', input),
});

export const cancelBookingTool = tool({
  name: 'cancelBooking',
  description:
    'Cancel a booking. Set confirmed=true ONLY after the caller explicitly confirms the cancellation in this turn. The backend rejects unconfirmed cancellations.',
  parameters: CancelBookingInput,
  execute: (input) => callTool('cancelBooking', input),
});
