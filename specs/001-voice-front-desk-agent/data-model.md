# Phase 1 Data Model: Voice Front-Desk Agent

**Feature**: `001-voice-front-desk-agent`
**Date**: 2026-06-12
**Store**: SQLite via Prisma (see research.md D7). All times stored as ISO-8601 UTC strings / `DateTime`.

---

## Entities

### Service
A bookable offering.

| Field | Type | Rules |
|---|---|---|
| `id` | string (cuid/uuid) | PK |
| `name` | string | unique, non-empty (e.g. "Haircut", "Bridal Package") |
| `durationMin` | int | > 0; drives slot length (research.md D8) |
| `price` | int | minor units (cents) ≥ 0 — avoids float money |

### Booking
A reserved appointment.

| Field | Type | Rules |
|---|---|---|
| `id` | string | PK; the confirmation id returned by `bookSlot` |
| `serviceId` | string | FK → Service.id |
| `startTime` | DateTime | within business hours |
| `endTime` | DateTime | = startTime + service.durationMin; > startTime |
| `customerName` | string | non-empty |
| `contact` | string | phone number (E.164-ish), non-empty (clarification 2026-06-12) |
| `status` | enum | `confirmed` \| `cancelled` (default `confirmed`) |
| `createdAt` | DateTime | set on insert |

**Invariant (no double-book, FR-006):** No two `confirmed` bookings for overlapping `[startTime, endTime)`. Enforced in the provider before write; conflict → reject + re-offer (not overwrite).

### FAQ
A grounded answer to a common question.

| Field | Type | Rules |
|---|---|---|
| `id` | string | PK |
| `topic` | string | unique key (e.g. "hours", "location", "parking", "cancellation-policy") |
| `answer` | string | grounded text; the only source for hours/location/policy answers (FR-010, SC-004) |

### CallbackRequest
A logged request for a human follow-up (escalation, FR-013a).

| Field | Type | Rules |
|---|---|---|
| `id` | string | PK |
| `customerName` | string | non-empty |
| `contact` | string | phone number |
| `reason` | string | free text message |
| `createdAt` | DateTime | set on insert |

### Confirmation (not persisted as a table — logged)
Mocked WhatsApp/SMS send (FR-014). Recorded to logs / an in-memory list keyed by `bookingId`, contact (phone), and timestamp. Returns `{ ok: true }`. No real delivery.

### TraceEvent (per-session, assembled in NestJS — research.md D9)
Ordered record relayed over `/realtime`. Not a long-lived DB table; held per session (optionally persisted for replay).

| Field | Type | Notes |
|---|---|---|
| `sessionId` | string | groups events |
| `seq` | int | order |
| `type` | enum | `tool_call` \| `tool_result` \| `handoff` \| `guardrail_trip` |
| `name` | string | tool name / target agent / guardrail name |
| `args` | json | tool input (redacted as needed) |
| `result` | json | tool output / decision |
| `ts` | DateTime | timestamp |

---

## Relationships

```
Service 1 ──< Booking        (Booking.serviceId → Service.id)
FAQ            (standalone)
CallbackRequest (standalone)
Booking 1 ──. Confirmation   (logged, by bookingId)
Session 1 ──< TraceEvent     (in-memory/per-session)
```

## Derived: Slot (NOT stored)
Computed by `checkAvailability` (research.md D8): for the requested service and date, generate candidate windows of `service.durationMin` within business hours on a 15-min step; emit those not overlapping any `confirmed` Booking; filter by `partOfDay` if provided.

```
Slot = { startTime, endTime, staffId? }   // ephemeral, returned by checkAvailability only
```

## State transitions (Booking)

```
        bookSlot (slot free, no overlap)
   ∅ ──────────────────────────────────▶ confirmed
                                            │  │
       rescheduleBooking (new slot free,    │  │ cancelBooking
       confirmed:true) → move start/end ◀───┘  │ (confirmed:true)
                                               ▼
                                           cancelled
```
- Reschedule/cancel require `confirmed: true` (FR-009) and a `bookingId` resolved via `lookupBooking` (FR-006a).
- Reschedule into an occupied slot → rejected, re-offer (FR-007).

## Seed data (FR-018)
- ~5 Services: Haircut (45m), Color (90m), Manicure (30m), Facial (60m), Bridal Package (180m), with prices.
- A week of business hours (e.g. Mon–Sat 09:00–18:00) — implicit via config, not rows.
- A handful of FAQs: hours, location, parking, cancellation policy, payment.
- 1–2 pre-existing `confirmed` Bookings (e.g. a color appointment Thu 14:00) so reschedule/cancel work live immediately.

## Validation rules → requirements traceability
- Phone-format contact ← FR-014, clarification.
- Overlap rejection ← FR-006, SC-003.
- `confirmed` flag gate on destructive ops ← FR-009, SC-005.
- FAQ/Services answers only from rows ← FR-010/FR-011, SC-004.
- Read-back before finalize ← FR-004 (enforced in agent flow; provider returns full booking for read-back).
