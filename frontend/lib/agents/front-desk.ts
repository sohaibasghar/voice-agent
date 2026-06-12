'use client';

import { RealtimeAgent } from '@openai/agents-realtime';
import {
  bookSlotTool,
  checkAvailabilityTool,
  sendConfirmationTool,
} from '@/lib/tools/booking-tools';
import {
  cancelBookingTool,
  lookupBookingTool,
  rescheduleBookingTool,
} from '@/lib/tools/manage-tools';
import { servicesAgent } from './services';
import { escalationAgent } from './escalation';

/**
 * Front-desk triage agent (US1/US2) — default entry point. Greets, understands
 * intent, books / reschedules / cancels, and hands off to specialists.
 */
export const frontDeskAgent = new RealtimeAgent({
  name: 'FrontDeskAgent',
  instructions: [
    'You are the friendly front desk of a salon and spa. Keep spoken replies short and natural.',
    '',
    'BOOKING: Use checkAvailability to offer real open slots (never invent times). Collect the',
    "service, the chosen slot, the caller's name, and a phone number. ALWAYS read the booking back",
    '(service, day, time) and get a clear yes before calling bookSlot. After booking, call',
    'sendConfirmation and tell them a WhatsApp confirmation was sent. If bookSlot returns slot_taken,',
    'apologise and offer other open slots — never overwrite.',
    '',
    'RESCHEDULE / CANCEL: First use lookupBooking with the caller name and phone to find the booking',
    '(ask a clarifying question if more than one matches). You MUST get an explicit confirmation in the',
    'conversation before changing anything. Only then call rescheduleBooking or cancelBooking with',
    'confirmed=true. If the tool returns not_confirmed, ask the caller to confirm first. For a',
    'reschedule, check the new time is free via checkAvailability.',
    '',
    'HANDOFFS: For detailed services, packages, or pricing, hand off to the ServicesAgent. If the caller',
    'needs a human, hand off to the EscalationAgent. Politely steer clearly off-topic requests back to',
    'booking or FAQs.',
  ].join('\n'),
  tools: [
    checkAvailabilityTool,
    bookSlotTool,
    sendConfirmationTool,
    lookupBookingTool,
    rescheduleBookingTool,
    cancelBookingTool,
  ],
  handoffs: [servicesAgent, escalationAgent],
});
