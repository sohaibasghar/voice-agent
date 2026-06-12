# Feature Specification: Voice Front-Desk Agent (Salon & Spa)

**Feature Branch**: `001-voice-front-desk-agent`  
**Created**: 2026-06-11  
**Status**: Draft  
**Input**: User description: "take this PRD-voice-front-desk-agent.md and generate all the specs"

## Clarifications

### Session 2026-06-12

- Q: Which persistence mechanism should back the calendar store? → A: SQLite (lightweight file DB) — bookings survive restart so seeded pre-existing bookings persist across runs.
- Q: Should the escalation/callback specialist agent be in scope for v1? → A: Yes, in scope — build the escalation agent plus callback-request logging now (third handoff branch).
- Q: How does a voice caller reference an existing booking for reschedule/cancel? → A: Agent looks up the booking by caller name + contact, then resolves the internal id behind the scenes.
- Q: What form does the caller contact take, and how is confirmation sent? → A: A phone number; confirmation is a mocked WhatsApp/SMS send to that number.
- Q: How are availability and bookable slots structured? → A: Fixed daily business hours; candidate slots are the requested service's duration long; a slot is open when it does not overlap an existing confirmed booking.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Book an appointment by voice (Priority: P1)

A caller opens the browser experience, speaks naturally to the front desk
("I'd like a haircut Thursday afternoon"), and is offered real open slots. The
caller picks one, gives their name and contact, and receives a spoken
confirmation plus a notice that a confirmation message was sent. The booking is
written to a real calendar store.

**Why this priority**: This is the core value driver and the demo happy path.
Without end-to-end booking by voice there is no product and no demo. Everything
else (reschedule, cancel, handoff, trace) is layered on top of this slice.

**Independent Test**: Seed the calendar with services and a week of
availability, start a voice session, request a service for a day/time, confirm a
spoken slot, provide name and contact, and verify a new confirmed booking exists
in the store that exactly matches what the agent read back.

**Acceptance Scenarios**:

1. **Given** open slots exist for the requested service and day, **When** the
   caller asks for that service and timeframe, **Then** the agent offers at least
   one concrete available slot drawn from the calendar store.
2. **Given** the caller selects an offered slot and provides name and contact,
   **When** the agent reads the booking back and the caller confirms, **Then** a
   confirmed booking is written and a confirmation id is returned.
3. **Given** a booking has just been written, **When** the agent finishes,
   **Then** it speaks a concise confirmation and states that a confirmation
   message was sent to the caller's channel.
4. **Given** the caller interrupts the agent mid-sentence, **When** the caller
   starts speaking, **Then** the agent stops talking and listens (barge-in).
5. **Given** the requested slot was taken between the offer and the booking
   attempt, **When** the agent tries to book, **Then** the booking is rejected
   and the agent re-offers alternative slots instead of overwriting.

---

### User Story 2 - Reschedule or cancel with explicit confirmation (Priority: P2)

A caller with an existing booking asks to move or cancel it. Before any
destructive change is committed, the agent must obtain explicit confirmation in
the conversation. Reschedules are only committed to a slot that is actually free.

**Why this priority**: Reschedule and cancel are essential front-desk
operations and the vehicle for the confirmation guardrail — a core demo beat.
They depend on a booking already existing (built in P1 or seeded).

**Independent Test**: Seed one or two pre-existing bookings, start a session,
ask to cancel or move a booking, observe that the agent blocks the destructive
action until the caller explicitly confirms, then verify the store reflects the
change (status cancelled, or moved to the new free slot).

**Acceptance Scenarios**:

1. **Given** a caller asks to cancel a booking, **When** the caller has not yet
   explicitly confirmed, **Then** the cancel action is blocked and the agent asks
   for confirmation first.
2. **Given** the caller explicitly confirms the cancellation, **When** the agent
   proceeds, **Then** the booking status becomes cancelled.
3. **Given** a caller asks to move a booking to a new time, **When** that new
   time is already taken, **Then** the reschedule is rejected and the agent
   re-offers free alternatives.
4. **Given** a caller asks to move a booking to a free time and confirms, **When**
   the agent proceeds, **Then** the booking is moved and no double-booking exists.

---

### User Story 3 - Get service and pricing answers via a specialist handoff (Priority: P3)

Mid-conversation, a caller asks a detailed question about services, packages, or
pricing ("Do you do bridal packages and how much?"). The triage front-desk agent
hands the conversation to a services specialist that answers from grounded
service data, then control can return to booking.

**Why this priority**: Demonstrates multi-agent handoff and grounded FAQ
answering. Valuable but not required for a minimal booking product; it enriches
the conversation and the demo trace.

**Independent Test**: Seed services, pricing, packages, and FAQs, then ask a
detailed pricing/package question and verify the answer comes from seeded data
(no fabricated price/hours) and that a handoff to the specialist occurred.

**Acceptance Scenarios**:

1. **Given** a caller asks a detailed service/pricing/package question, **When**
   the triage agent recognizes it is out of its scope, **Then** it hands off to
   the services specialist.
2. **Given** the services specialist answers, **When** it states hours, prices,
   or policies, **Then** the answer matches seeded data with no fabricated
   figures.
3. **Given** the specialist has answered, **When** the caller returns to booking,
   **Then** the conversation can continue the booking flow.
4. **Given** a caller asks something entirely off-topic, **When** the agent
   responds, **Then** it politely declines and steers back to booking or FAQ.

---

### User Story 4 - Inspect the full interaction as a trace (Priority: P3)

A developer reviewing the system opens a trace view after a run and can follow,
step by step, which tools fired and with what arguments, where a handoff
decision branched, and where a guardrail blocked an action.

**Why this priority**: This is the developer-audience payoff and the artifact's
second purpose. It does not change the caller experience but is essential to the
demo's value and to trusting the system.

**Independent Test**: Run a session that includes a booking, a handoff, and a
blocked destructive action, then open the trace and confirm each tool call,
handoff branch, and guardrail trip is visible and inspectable after the run.

**Acceptance Scenarios**:

1. **Given** a completed session, **When** a developer opens the trace, **Then**
   every tool call is listed with its input arguments and result.
2. **Given** a session included a handoff, **When** the trace is reviewed,
   **Then** the handoff decision and branch are visible.
3. **Given** a session included a blocked destructive action, **When** the trace
   is reviewed, **Then** the guardrail trip is visible at the point it occurred.

---

### Edge Cases

- Caller requests a service that does not exist in the catalog → agent states it
  is not offered and suggests available services.
- Caller requests a day/time with no availability → agent reports none free and
  offers the nearest open alternatives.
- Caller gives an ambiguous time ("afternoon") → agent narrows to concrete
  offered slots rather than guessing a precise time.
- Caller references a booking that cannot be found → agent asks for clarifying
  detail instead of acting on the wrong record.
- Caller talks over the agent repeatedly → barge-in remains responsive each time.
- Network/connectivity degrades mid-session → the run can be reset to a known
  seeded state and re-run cleanly.
- Caller abandons mid-booking (no confirmation) → no partial/confirmed booking is
  written.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST let a caller conduct a spoken conversation with the
  front desk in real time, with natural turn-taking.
- **FR-002**: System MUST support barge-in — when the caller begins speaking, the
  agent stops talking and listens.
- **FR-003**: System MUST offer only appointment slots that are actually open in
  the calendar store for the requested service and timeframe. Candidate slots fall
  within fixed daily business hours and are the requested service's duration long;
  a slot is open only when it does not overlap an existing confirmed booking.
- **FR-004**: System MUST read the booking back (service, day, time) to the
  caller and obtain confirmation before finalizing it.
- **FR-005**: System MUST write a confirmed booking to a persistent calendar
  store and return a confirmation identifier.
- **FR-006**: System MUST reject a booking that would conflict with an existing
  booking (no double-booking) and re-offer alternatives instead of overwriting.
- **FR-006a**: System MUST locate a caller's existing booking by caller name and
  contact (resolving to the internal identifier behind the scenes), and MUST ask a
  disambiguating question when more than one booking matches.
- **FR-007**: System MUST allow a caller to reschedule an existing booking, and
  MUST validate the new time is free before committing.
- **FR-008**: System MUST allow a caller to cancel an existing booking.
- **FR-009**: System MUST require explicit caller confirmation in the
  conversation before committing any destructive action (cancel, reschedule), and
  MUST block the action when confirmation is absent.
- **FR-010**: System MUST answer common questions (hours, location, policies)
  from grounded data and MUST NOT fabricate answers.
- **FR-011**: System MUST answer service, pricing, and package questions from
  grounded service data with no fabricated figures.
- **FR-012**: System MUST route detailed service/pricing questions to a services
  specialist via a handoff, and MUST allow the conversation to return to booking.
- **FR-013**: System MUST politely decline off-topic requests and steer the
  caller back to booking or FAQ.
- **FR-013a**: System MUST route a caller who needs a human to an escalation
  specialist via a handoff, log a callback request (caller name, contact, reason),
  and confirm to the caller that a human will follow up.
- **FR-014**: System MUST capture the caller's contact as a phone number and,
  after a booking, record a mocked WhatsApp/SMS confirmation send to that number
  and report that it was sent.
- **FR-015**: System MUST produce an inspectable trace of each run showing every
  tool call with arguments and results, handoff decisions, and guardrail trips.
- **FR-016**: System MUST keep any provider/model credential server-side; it MUST
  NOT be exposed to the browser client.
- **FR-017**: System MUST provide a way to reset demo data to a known seeded
  state between runs.
- **FR-018**: System MUST be seeded with realistic data: a set of services, a
  week of availability, a set of FAQs, and one or more pre-existing bookings so
  reschedule/cancel can be exercised immediately.
- **FR-019**: System MUST allow switching between a lower-cost configuration for
  development and a higher-quality configuration for live runs via a single
  configuration switch.
- **FR-020**: System MUST keep spoken confirmations concise, with detailed
  "receipt" information delivered to the confirmation channel rather than read
  aloud in full.

### Key Entities *(include if feature involves data)*

- **Service**: An offering the business books (e.g., haircut, color, manicure,
  facial, bridal package). Attributes: name, duration, price.
- **Slot**: A bookable time window within fixed daily business hours, the length
  of the requested service's duration. Attributes: start time, end time, optional
  staff reference. A slot is open only when it does not overlap an existing
  confirmed booking.
- **Booking**: A reserved appointment. Attributes: identifier, the service,
  start/end time, customer name, contact (phone number), and status (confirmed or
  cancelled).
- **FAQ**: A grounded answer to a common question. Attributes: topic, answer
  (covers hours, location, policies).
- **Confirmation**: A message sent to the caller's channel referencing a booking
  (mocked in this version).
- **CallbackRequest**: A logged request for a human to follow up. Attributes:
  caller name, contact, reason/message, created time.
- **Trace**: A post-run record of the interaction — tool calls with arguments and
  results, handoff branches, and guardrail trips.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A caller can complete a booking end-to-end by voice in a single
  conversation without operator intervention.
- **SC-002**: 100% of confirmed bookings match exactly what the agent read back
  to the caller (service, day, time).
- **SC-003**: Zero double-bookings occur across the test run set.
- **SC-004**: Across a 20-run test set, no fabricated hours, prices, or policies
  appear in any answer (FAQ groundedness).
- **SC-005**: 100% of destructive actions (cancel, reschedule) are preceded by an
  explicit caller confirmation; no destructive action commits without one.
- **SC-006**: Perceived response start is under ~1 second and barge-in feels
  instant to the caller.
- **SC-007**: After any run, a reviewer can follow the trace and correctly
  identify every tool call, the handoff branch, and the guardrail trip without
  consulting the agent's spoken narration.
- **SC-008**: The full demonstration narrative (happy-path booking, handoff,
  guardrail, trace walkthrough) runs within 4–6 minutes.
- **SC-009**: Demo data can be reset to a known state and the full run repeated
  cleanly between takes.

## Assumptions

- **Browser voice only (no telephony)**: Interaction is via the browser using
  real-time audio. Real phone calls (PSTN/Twilio) are out of scope for this
  version but the audio transport is isolated so it can be swapped later without
  changing agents, tools, guardrails, or data model.
- **Persistence survives restart**: A lightweight persistent store (SQLite) backs
  the calendar so pre-existing bookings survive a restart, enabling a live
  reschedule/cancel of a seeded booking. (Resolved; PRD open question 1.)
- **Escalation/callback specialist in scope**: A third "take a message for a
  human" specialist agent is in scope; it logs a callback request (no outbound
  dialing). (Resolved; PRD open question 2.)
- **Confirmation sending is mocked**: Real WhatsApp/SMS delivery is out of scope;
  the system records/logs a mocked send and reports success.
- **Outbound reminders are not dialed**: Any reminders are logged/mocked, not
  actually sent or called.
- **No payments/deposits**: Booking does not collect or process payment.
- **Single-tenant, single-location demo**: No multi-location or multi-tenant
  management, and no staff/calendar admin UI; data is seeded directly.
- **No production auth/RBAC/data-retention tooling**: The experience targets a
  controlled demo and prototype context, not production access control or
  compliance tooling.
- **Reliable-on-stage requirement**: The experience must run on untrusted
  conference wifi, and a pre-recorded fallback of the exact run is kept as a
  contingency.
- **Real, reusable logic**: Agent logic, tools, and data model are the real
  product ones (not throwaway demo scaffolding), so they remain reusable for the
  broader front-desk product.
