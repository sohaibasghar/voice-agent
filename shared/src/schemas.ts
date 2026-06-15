import { z } from 'zod';

/**
 * Canonical Zod contracts for the Voice Front-Desk Agent.
 * Single source of truth imported by both the NestJS backend (tool providers,
 * controller validation) and the Next.js frontend (tool() proxy definitions),
 * so tool I/O cannot drift. See specs/001-voice-front-desk-agent/contracts/tools.md.
 */

// ── Shared primitives ────────────────────────────────────────────────────────

export const PartOfDay = z.enum(['morning', 'afternoon', 'evening']);
export type PartOfDay = z.infer<typeof PartOfDay>;

export const BookingStatus = z.enum(['confirmed', 'cancelled']);
export type BookingStatus = z.infer<typeof BookingStatus>;

/** Loose phone validation — demo-scale, accepts E.164-ish and common formats. */
export const Phone = z
  .string()
  .trim()
  .min(7, 'contact must be a phone number')
  .regex(/^[+]?[\d\s().-]{7,20}$/, 'contact must be a phone number');

export const SlotSchema = z.object({
  startTime: z.string(), // ISO-8601
  endTime: z.string(),
  staffId: z.string().optional(),
});
export type Slot = z.infer<typeof SlotSchema>;

export const BookingViewSchema = z.object({
  id: z.string(),
  serviceName: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  customerName: z.string(),
  contact: z.string(),
  status: BookingStatus,
});
export type BookingView = z.infer<typeof BookingViewSchema>;

// ── checkAvailability (FR-003) ───────────────────────────────────────────────

export const CheckAvailabilityInput = z.object({
  service: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD'),
  partOfDay: PartOfDay.optional(),
});
export type CheckAvailabilityInput = z.infer<typeof CheckAvailabilityInput>;

export const CheckAvailabilityOutput = z.object({ slots: z.array(SlotSchema) });
export type CheckAvailabilityOutput = z.infer<typeof CheckAvailabilityOutput>;

// ── lookupBooking (FR-006a) ──────────────────────────────────────────────────

export const LookupBookingInput = z.object({
  customerName: z.string(),
  contact: z.string(),
});
export type LookupBookingInput = z.infer<typeof LookupBookingInput>;

export const LookupBookingOutput = z.object({ matches: z.array(BookingViewSchema) });
export type LookupBookingOutput = z.infer<typeof LookupBookingOutput>;

// ── bookSlot (FR-005, FR-006) ────────────────────────────────────────────────

export const BookSlotInput = z.object({
  service: z.string(),
  startTime: z.string(),
  customerName: z.string().min(1),
  contact: Phone,
});
export type BookSlotInput = z.infer<typeof BookSlotInput>;

export const BookSlotOutput = z.object({
  bookingId: z.string(),
  booking: BookingViewSchema,
});
export type BookSlotOutput = z.infer<typeof BookSlotOutput>;

// ── rescheduleBooking (FR-007, FR-009) ───────────────────────────────────────

export const RescheduleBookingInput = z.object({
  bookingId: z.string(),
  newStartTime: z.string(),
  confirmed: z.boolean(),
});
export type RescheduleBookingInput = z.infer<typeof RescheduleBookingInput>;

export const RescheduleBookingOutput = z.object({ booking: BookingViewSchema });
export type RescheduleBookingOutput = z.infer<typeof RescheduleBookingOutput>;

// ── cancelBooking (FR-008, FR-009) ───────────────────────────────────────────

export const CancelBookingInput = z.object({
  bookingId: z.string(),
  confirmed: z.boolean(),
});
export type CancelBookingInput = z.infer<typeof CancelBookingInput>;

export const CancelBookingOutput = z.object({ booking: BookingViewSchema });
export type CancelBookingOutput = z.infer<typeof CancelBookingOutput>;

// ── lookupFAQ (FR-010) ───────────────────────────────────────────────────────

export const LookupFaqInput = z.object({ topic: z.string() });
export type LookupFaqInput = z.infer<typeof LookupFaqInput>;

export const LookupFaqOutput = z.object({
  topic: z.string().nullable(),
  answer: z.string().nullable(),
});
export type LookupFaqOutput = z.infer<typeof LookupFaqOutput>;

// ── lookupServices (FR-011) ──────────────────────────────────────────────────

export const LookupServicesInput = z.object({ query: z.string() });
export type LookupServicesInput = z.infer<typeof LookupServicesInput>;

export const ServiceInfoSchema = z.object({
  name: z.string(),
  durationMin: z.number(),
  price: z.number(), // minor units (cents)
  category: z.string().optional(),
});
export type ServiceInfo = z.infer<typeof ServiceInfoSchema>;

export const LookupServicesOutput = z.object({ services: z.array(ServiceInfoSchema) });
export type LookupServicesOutput = z.infer<typeof LookupServicesOutput>;

// ── sendConfirmation (FR-014) ────────────────────────────────────────────────

export const SendConfirmationInput = z.object({
  contact: Phone,
  bookingId: z.string(),
});
export type SendConfirmationInput = z.infer<typeof SendConfirmationInput>;

export const SendConfirmationOutput = z.object({
  ok: z.literal(true),
  channel: z.literal('whatsapp_sms_mock'),
});
export type SendConfirmationOutput = z.infer<typeof SendConfirmationOutput>;

// ── logCallback (FR-013a — escalation) ───────────────────────────────────────

export const LogCallbackInput = z.object({
  customerName: z.string().min(1),
  contact: Phone,
  reason: z.string(),
});
export type LogCallbackInput = z.infer<typeof LogCallbackInput>;

export const LogCallbackOutput = z.object({ callbackId: z.string() });
export type LogCallbackOutput = z.infer<typeof LogCallbackOutput>;

// ── Session token (POST /session) ────────────────────────────────────────────

export const SessionTokenOutput = z.object({
  value: z.string(),
  model: z.string(),
  expiresAt: z.string(),
});
export type SessionTokenOutput = z.infer<typeof SessionTokenOutput>;

// ── Relay / trace events (WS /realtime, research.md D9) ──────────────────────

export const TraceEventType = z.enum([
  'tool_call',
  'tool_result',
  'handoff',
  'guardrail_trip',
]);
export type TraceEventType = z.infer<typeof TraceEventType>;

export const RelayEventSchema = z.object({
  sessionId: z.string(),
  type: TraceEventType,
  name: z.string(),
  args: z.unknown().optional(),
  result: z.unknown().optional(),
  detail: z.string().optional(),
  ts: z.string(),
});
export type RelayEvent = z.infer<typeof RelayEventSchema>;

export const TraceEventSchema = RelayEventSchema.extend({ seq: z.number() });
export type TraceEvent = z.infer<typeof TraceEventSchema>;

// ── Tool error codes (server-authoritative guardrails) ───────────────────────

export const TOOL_ERROR_CODES = [
  'service_not_found',
  'slot_taken',
  'outside_business_hours',
  'booking_not_found',
  'not_confirmed',
] as const;
export type ToolErrorCode = (typeof TOOL_ERROR_CODES)[number];
