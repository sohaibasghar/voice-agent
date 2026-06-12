'use client';

import { tool } from '@openai/agents-realtime';
import {
  BookSlotInput,
  CheckAvailabilityInput,
  SendConfirmationInput,
} from '@voice-agent/shared';
import { callTool } from './proxy';

/** US1 tools — thin proxies to the backend providers. */

export const checkAvailabilityTool = tool({
  name: 'checkAvailability',
  description:
    'Find open appointment slots for a service on a date. Optionally narrow to a part of the day (morning/afternoon/evening).',
  parameters: CheckAvailabilityInput,
  execute: (input) => callTool('checkAvailability', input),
});

export const bookSlotTool = tool({
  name: 'bookSlot',
  description:
    'Book a confirmed appointment after reading the details back and the caller agrees. Provide service, ISO startTime, customer name, and phone contact. Rejects double-booking.',
  parameters: BookSlotInput,
  execute: (input) => callTool('bookSlot', input),
});

export const sendConfirmationTool = tool({
  name: 'sendConfirmation',
  description:
    'Send a WhatsApp/SMS confirmation for a booking to the caller phone number (mocked in this version).',
  parameters: SendConfirmationInput,
  execute: (input) => callTool('sendConfirmation', input),
});
