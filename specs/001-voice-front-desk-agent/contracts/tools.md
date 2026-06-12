# Tool Contracts (Zod I/O)

**Feature**: `001-voice-front-desk-agent`

Each tool is a NestJS provider exposed at `POST /tools/<name>` and mirrored by a browser-side `tool()` whose `execute` proxies to it (research.md D3/D4). Schemas below are the shared contract (live in `shared/`). Times are ISO-8601. Money is integer cents.

## Shared types
```ts
PartOfDay   = 'morning' | 'afternoon' | 'evening'
BookingStatus = 'confirmed' | 'cancelled'
Slot        = { startTime: string; endTime: string; staffId?: string }
BookingView = { id; serviceName; startTime; endTime; customerName; contact; status }
```

## checkAvailability  (FR-003)
- **In**: `{ service: string; date: string /*YYYY-MM-DD*/; partOfDay?: PartOfDay }`
- **Out**: `{ slots: Slot[] }`  — empty array if none free
- **Errors**: `service_not_found`

## lookupBooking  (FR-006a)
- **In**: `{ customerName: string; contact: string }`
- **Out**: `{ matches: BookingView[] }` — 0, 1, or many; agent disambiguates if >1
- Notes: read-only; how the agent resolves an internal `bookingId` before reschedule/cancel.

## bookSlot  (FR-005, FR-006)
- **In**: `{ service: string; startTime: string; customerName: string; contact: string /*phone*/ }`
- **Out**: `{ bookingId: string; booking: BookingView }`
- **Errors**: `service_not_found`, `slot_taken` (overlap → agent must re-offer, never overwrite), `outside_business_hours`
- Server enforces no-overlap with `confirmed` bookings authoritatively.

## rescheduleBooking  (FR-007, FR-009)
- **In**: `{ bookingId: string; newStartTime: string; confirmed: boolean }`
- **Out**: `{ booking: BookingView }`
- **Errors**: `not_confirmed` (when `confirmed !== true` → guardrail trip), `booking_not_found`, `slot_taken`, `outside_business_hours`
- Validates new slot free before moving.

## cancelBooking  (FR-008, FR-009)
- **In**: `{ bookingId: string; confirmed: boolean }`
- **Out**: `{ booking: BookingView /* status: cancelled */ }`
- **Errors**: `not_confirmed` (guardrail trip), `booking_not_found`

## lookupFAQ  (FR-010)
- **In**: `{ topic: string }`
- **Out**: `{ topic: string; answer: string } | { answer: null }` (no fabrication; null → agent says it doesn't have that info)

## lookupServices  (FR-011)
- **In**: `{ query: string }`
- **Out**: `{ services: { name: string; durationMin: number; price: number }[] }` — grounded; empty if no match

## sendConfirmation  (FR-014)
- **In**: `{ contact: string /*phone*/; bookingId: string }`
- **Out**: `{ ok: true; channel: 'whatsapp_sms_mock' }`  — logs a mocked send; no real delivery

## logCallback  (FR-013a — escalation)
- **In**: `{ customerName: string; contact: string; reason: string }`
- **Out**: `{ callbackId: string }`

## Guardrail contract (server-authoritative — research.md D6)
- Destructive tools (`cancelBooking`, `rescheduleBooking`) reject with `not_confirmed` unless `confirmed === true`. The agent sets `confirmed: true` only after the caller explicitly confirms in-turn. The rejection is relayed as a `guardrail_trip` trace event.
- `bookSlot`/`rescheduleBooking` overlap rejection (`slot_taken`) is the no-double-book guardrail.
