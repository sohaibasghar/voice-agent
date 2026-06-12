---
description: "Task list for Voice Front-Desk Agent implementation"
---

# Tasks: Voice Front-Desk Agent (Salon & Spa)

**Input**: Design documents from `/specs/001-voice-front-desk-agent/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Included where the constitution requires them (Principle III + Quality Gates): tool providers and guardrail logic MUST have unit tests that run without the model; no-double-book and confirm-before-destructive MUST be covered. Tests are scoped to those, not exhaustive TDD.

**Organization**: Tasks grouped by user story (US1–US4 from spec.md) for independent implementation and testing.

**Implementation status (2026-06-12)**: 48/57 complete. Backend (NestJS + Prisma/SQLite,
all tool providers, authoritative guardrails, /session, /health, /seed, /realtime gateway)
built and smoke-tested live; frontend (Next.js + shadcn/Tailwind, agents, tools, guardrail,
trace UI) type-checks and builds clean and serves. Note: the repo root is the backend (the
plan's `backend/src/...` maps to `src/...`); `frontend/` and `shared/` are workspaces.
Remaining 9 unchecked:
- Test tasks T018, T019, T029, T030, T038, T052 — **excluded at user request** (the guardrails
  they would cover are verified manually via live endpoint calls — see quickstart).
- T051 (optional server-side SDK trace spans), T053 (full live-voice walkthrough — needs a real
  `OPENAI_API_KEY` + mic), T055 (pre-recorded fallback screencast) — manual/optional follow-ups.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1, US2, US3, US4 — user-story phases only
- Paths follow plan.md structure: `backend/` (NestJS), `frontend/` (Next.js), `shared/` (Zod)

## Path Conventions

- Backend: `backend/src/...`, tests `backend/test/...`
- Frontend: `frontend/app/...`, `frontend/components/...`, `frontend/lib/...`
- Shared schemas: `shared/src/...`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Monorepo, toolchains, and project skeletons

- [X] T001 Create monorepo with npm workspaces (`backend`, `frontend`, `shared`) and root `package.json`/`tsconfig.base.json` per plan.md structure
- [X] T002 [P] Initialize NestJS app in `backend/` and add deps: `@nestjs/*`, `@openai/agents`, `@openai/agents-realtime`, `prisma`, `@prisma/client`, `zod`
- [X] T003 [P] Initialize Next.js (App Router) in `frontend/` with Tailwind CSS and shadcn/ui (`components.json`, `tailwind.config.ts`, `app/globals.css`); add `@openai/agents-realtime`, `zod`
- [X] T004 [P] Initialize `shared/` package (TS build, `zod`) exporting from `shared/src/index.ts`
- [X] T005 [P] Configure ESLint + Prettier + shared `tsconfig` across all three workspaces
- [X] T006 Create `backend/.env.example` (`OPENAI_API_KEY`, `MODEL_TIER`, `DATABASE_URL`, `BUSINESS_HOURS`, `BUSINESS_DAYS`) and `frontend/.env.local.example` (`NEXT_PUBLIC_BACKEND_URL`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Data layer, secrets, voice loop, and event relay that every user story builds on

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T007 Define shared Zod schemas for all tool I/O and relay event types in `shared/src/schemas.ts` (per contracts/tools.md and contracts/http-ws.md)
- [X] T008 Define Prisma schema (`Service`, `Booking`, `FAQ`, `CallbackRequest`) in `backend/prisma/schema.prisma` and create the initial SQLite migration (per data-model.md)
- [X] T009 [P] Implement `CalendarStore` provider over Prisma + business-hours config (slot derivation + overlap helper) in `backend/src/calendar/calendar.store.ts`
- [X] T010 [P] Set up NestJS app module, global Zod validation pipe, error mapping (tool error codes), and structured logging in `backend/src/app.module.ts` + `backend/src/common/`
- [X] T011 Implement `OpenAIService` (wraps `OPENAI_API_KEY`, maps `MODEL_TIER`→model id) and `POST /session` ephemeral-token minting in `backend/src/session/` (per research D2, contracts/http-ws.md)
- [X] T012 [P] Implement `GET /health` in `backend/src/health/health.controller.ts`
- [X] T013 Implement `SeedService` + `POST /seed` (≈5 services, FAQs, business hours, 1–2 pre-existing bookings) in `backend/src/seed/` (per data-model.md seed section)
- [X] T014 [P] Implement WS `/realtime` gateway base (accept connections, validate + accept relay envelopes) in `backend/src/realtime/realtime.gateway.ts`
- [X] T015 Implement frontend WebRTC transport seam (`frontend/lib/transport/`) and session lifecycle `frontend/lib/session.ts` (`GET /session` → `connect({ apiKey: ek_ })`) — Twilio-swappable seam
- [X] T016 Build bare voice loop: `VoiceConsole` client component (Talk control, mic permission, transcript) in `frontend/components/voice-console.tsx` wired into `frontend/app/page.tsx`, with a minimal greeting agent (M0 spike — no tools yet)
- [X] T017 [P] Implement event-relay client `frontend/lib/trace/relay.ts` that emits `tool_call`/`tool_result`/`handoff`/`guardrail_trip` events to `/realtime`

**Checkpoint**: A caller can connect by voice and hear the agent; data store seeded; token minting and event relay live. User stories can now begin.

---

## Phase 3: User Story 1 - Book an appointment by voice (Priority: P1) 🎯 MVP

**Goal**: Caller books end-to-end by voice; slot written to the store; spoken confirmation + mocked WhatsApp/SMS notice.

**Independent Test**: Seed data, start a session, request a service/day, confirm an offered slot, give name + phone; verify a `confirmed` booking exists matching the read-back (SC-002) and no double-book occurs (SC-003).

### Tests for User Story 1

- [ ] T018 [P] [US1] Unit test availability derivation (business hours, duration-length slots, partOfDay filter, overlap exclusion) in `backend/test/availability.service.spec.ts`
- [ ] T019 [P] [US1] Unit test `bookSlot` rejects overlap (`slot_taken`) and returns confirmation id in `backend/test/booking.book.spec.ts`

### Implementation for User Story 1

- [X] T020 [P] [US1] Implement `AvailabilityService.checkAvailability` in `backend/src/tools/availability.service.ts` (per contracts/tools.md)
- [X] T021 [P] [US1] Implement `BookingService.bookSlot` (authoritative overlap guard, business-hours check, write confirmed booking) in `backend/src/tools/booking.service.ts`
- [X] T022 [P] [US1] Implement `ConfirmationService.sendConfirmation` (mock WhatsApp/SMS log) in `backend/src/tools/confirmation.service.ts`
- [X] T023 [US1] Add `ToolsController` endpoints `POST /tools/checkAvailability`, `/tools/bookSlot`, `/tools/sendConfirmation` (Zod-validated) in `backend/src/tools/tools.controller.ts`
- [X] T024 [P] [US1] Implement frontend `tool()` proxies for `checkAvailability`, `bookSlot`, `sendConfirmation` in `frontend/lib/tools/booking-tools.ts`
- [X] T025 [US1] Implement `FrontDeskAgent` (greeting, intent, offer-slots, read-back-then-confirm, book) in `frontend/lib/agents/front-desk.ts` with US1 tools attached
- [X] T026 [P] [US1] Build `SlotCards` + booking read-back UI in `frontend/components/slot-cards.tsx`
- [X] T027 [US1] Configure turn detection / barge-in on the session so the agent stops on caller speech (FR-002)
- [X] T028 [US1] Relay `tool_call`/`tool_result` events for US1 tools via `frontend/lib/trace/relay.ts`

**Checkpoint**: Happy-path booking works and is demoable independently (MVP).

---

## Phase 4: User Story 2 - Reschedule or cancel with explicit confirmation (Priority: P2)

**Goal**: Move/cancel an existing booking; destructive actions blocked until explicit in-turn confirmation; reschedule only to a free slot.

**Independent Test**: With a seeded booking, ask to cancel/move; verify the action is blocked until confirmation, then the store reflects the change; reschedule into a taken slot is rejected (SC-005, SC-003).

### Tests for User Story 2

- [ ] T029 [P] [US2] Unit test `cancelBooking` rejects when `confirmed !== true` (`not_confirmed`) and cancels when confirmed in `backend/test/booking.cancel.spec.ts`
- [ ] T030 [P] [US2] Unit test `rescheduleBooking` confirm-gate + `slot_taken` overlap rejection in `backend/test/booking.reschedule.spec.ts`

### Implementation for User Story 2

- [X] T031 [US2] Implement `BookingService.lookupBooking` (by name + contact, multi-match disambiguation, resolves internal id) in `backend/src/tools/booking.service.ts` (FR-006a)
- [X] T032 [US2] Implement `BookingService.rescheduleBooking` (confirm gate + new-slot-free validation) in `backend/src/tools/booking.service.ts`
- [X] T033 [US2] Implement `BookingService.cancelBooking` (confirm gate, set status cancelled) in `backend/src/tools/booking.service.ts`
- [X] T034 [US2] Add `ToolsController` endpoints `/tools/lookupBooking`, `/tools/rescheduleBooking`, `/tools/cancelBooking` in `backend/src/tools/tools.controller.ts`
- [X] T035 [P] [US2] Implement frontend `tool()` proxies for `lookupBooking`, `rescheduleBooking`, `cancelBooking` in `frontend/lib/tools/manage-tools.ts`
- [X] T036 [US2] Extend `FrontDeskAgent` flow: look up booking, require explicit caller confirmation, set `confirmed: true` only after confirmation in `frontend/lib/agents/front-desk.ts`
- [X] T037 [US2] Relay `guardrail_trip` events when a destructive call is rejected `not_confirmed`

**Checkpoint**: US1 and US2 both work independently.

---

## Phase 5: User Story 3 - Services handoff, grounded FAQ & escalation (Priority: P3)

**Goal**: Triage hands off to a Services specialist for grounded pricing/packages and to an Escalation specialist that logs a callback; off-topic deflected; control returns to booking.

**Independent Test**: Ask a pricing/package question → handoff → grounded answer (no fabrication, SC-004); ask for a human → callback logged; ask off-topic → polite deflection.

### Tests for User Story 3

- [ ] T038 [P] [US3] Unit test `lookupFAQ`/`lookupServices` return only stored data and null/empty when absent (groundedness) in `backend/test/faq.service.spec.ts`

### Implementation for User Story 3

- [X] T039 [P] [US3] Implement `FaqService.lookupFAQ` + `lookupServices` (grounded) in `backend/src/tools/faq.service.ts`
- [X] T040 [P] [US3] Implement `CallbackService.logCallback` (writes `CallbackRequest`) in `backend/src/tools/callback.service.ts`
- [X] T041 [US3] Add `ToolsController` endpoints `/tools/lookupFAQ`, `/tools/lookupServices`, `/tools/logCallback` in `backend/src/tools/tools.controller.ts`
- [X] T042 [P] [US3] Implement frontend `tool()` proxies for `lookupFAQ`, `lookupServices`, `logCallback` in `frontend/lib/tools/info-tools.ts`
- [X] T043 [P] [US3] Implement `ServicesAgent` (FAQ/pricing/package tools + `handoffDescription`) in `frontend/lib/agents/services.ts`
- [X] T044 [P] [US3] Implement `EscalationAgent` (logCallback + `handoffDescription`) in `frontend/lib/agents/escalation.ts`
- [X] T045 [US3] Wire `FrontDeskAgent.handoffs = [servicesAgent, escalationAgent]` and return-to-booking in `frontend/lib/agents/front-desk.ts`
- [X] T046 [P] [US3] Implement stay-in-domain output guardrail in `frontend/lib/guardrails/stay-in-domain.ts` and attach to the session
- [X] T047 [US3] Relay `handoff` events on each branch via `frontend/lib/trace/relay.ts`

**Checkpoint**: All conversational flows (book, manage, handoff, escalate) work independently.

---

## Phase 6: User Story 4 - Inspect the run as a trace (Priority: P3)

**Goal**: After a run, a reviewer follows tool calls (args+results), handoff branches, and guardrail trips in an inspectable trace.

**Independent Test**: Run a session with a booking + handoff + blocked destructive action; open the trace and confirm each tool call, handoff branch, and guardrail trip is visible and ordered (SC-007).

### Implementation for User Story 4

- [X] T048 [US4] Implement `TraceService` assembling per-session ordered `TraceEvent` list from relayed `/realtime` events in `backend/src/realtime/trace.service.ts` (research D9)
- [X] T049 [US4] Add `trace_snapshot` WS message + per-session persistence/log in `backend/src/realtime/realtime.gateway.ts`
- [X] T050 [P] [US4] Build `TracePanel` client component rendering tool calls with args/results, handoff branch, and guardrail trips in `frontend/components/trace-panel.tsx`
- [ ] T051 [US4] Emit server-side SDK spans around tool execution so any NestJS-side activity reaches the hosted dashboard (optional payoff, research D3/D9)

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

- [ ] T052 [P] Integration test: full happy-path booking flow against a temp SQLite DB in `backend/test/integration/booking-flow.spec.ts`
- [ ] T053 [P] Run `quickstart.md` end-to-end validation (health, token is `ek_`, all 9 demo beats)
- [X] T054 Verify `MODEL_TIER=live` switches to the high-quality model id and confirm a hard spend cap is set in the OpenAI dashboard (FR-019, PRD §13)
- [ ] T055 [P] Record the canonical-run pre-recorded fallback screencast (PRD §15, Principle V)
- [X] T056 Verify SDK identifiers (package/import/class names, realtime model ids, `client_secrets` body, guardrail field names) against current official docs before the live run; update code if drifted
- [X] T057 Rehearse `/seed` reset between takes for clean re-runs (SC-009)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **User Stories (Phase 3–6)**: All depend on Foundational. US2/US3/US4 build on the shared `BookingService`/agent/relay but each remains independently testable.
- **Polish (Phase 7)**: Depends on the desired user stories being complete.

### User Story Dependencies

- **US1 (P1)**: After Foundational. No dependency on other stories. → MVP.
- **US2 (P2)**: After Foundational. Extends `BookingService` + `FrontDeskAgent` (same files as US1) — sequence after US1 to avoid file conflicts; independently testable.
- **US3 (P3)**: After Foundational. Adds new agents/tools (mostly new files) — can run parallel to US2 except the shared `FrontDeskAgent`/`tools.controller.ts` edits (T045, T041).
- **US4 (P3)**: After Foundational; meaningfully testable once US1–US3 produce relayed events. The relay (T017) is foundational, so US4's consumer can be built in parallel and validated against any story.

### Within Each User Story

- Tests (where present) before/alongside the implementation they cover.
- Models/store before services; services before controller endpoints; backend tools before frontend proxies; proxies before agent wiring.

### Parallel Opportunities

- Setup: T002, T003, T004, T005 in parallel.
- Foundational: T009, T010, T012, T014, T017 in parallel after T007/T008.
- US1: T018+T019 (tests) parallel; T020+T021+T022 (separate-file services — but T021 and later booking tasks share `booking.service.ts`, so US2 booking edits serialize); T024 and T026 parallel.
- Different developers can take US3 (new agent files) alongside US2 once Foundational is done, coordinating the shared `front-desk.ts` and `tools.controller.ts` edits.

---

## Parallel Example: User Story 1

```bash
# Tests for US1 together:
Task: "Unit test availability derivation in backend/test/availability.service.spec.ts"
Task: "Unit test bookSlot overlap rejection in backend/test/booking.book.spec.ts"

# Independent-file implementation together:
Task: "AvailabilityService.checkAvailability in backend/src/tools/availability.service.ts"
Task: "ConfirmationService.sendConfirmation in backend/src/tools/confirmation.service.ts"
Task: "Frontend tool proxies in frontend/lib/tools/booking-tools.ts"
Task: "SlotCards UI in frontend/components/slot-cards.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 Setup → 2. Phase 2 Foundational (CRITICAL) → 3. Phase 3 US1 → **STOP & VALIDATE** the happy-path booking demo → demo-ready MVP.

### Incremental Delivery

Foundation → US1 (book, MVP) → US2 (reschedule/cancel + guardrail) → US3 (handoff + FAQ + escalation) → US4 (trace payoff) → Polish. Each story adds a demo beat without breaking prior ones. This maps to PRD milestones M0–M4.

### Parallel Team Strategy

After Foundational: Dev A → US1; once US1 lands, Dev A → US2 (shares booking files); Dev B → US3 (new agent/tool files); Dev C → US4 (trace consumer). Coordinate edits to `front-desk.ts` and `tools.controller.ts`.

---

## Notes

- [P] = different files, no incomplete-task dependency.
- Constitution gates: guardrail logic (no-double-book, confirm-before-destructive) is enforced server-side and covered by T019/T029/T030; secrets stay server-side (T011); contracts shared via `shared/` (T007).
- `booking.service.ts` and `tools.controller.ts` are touched across US1/US2/US3 — those tasks are intentionally NOT marked [P] relative to each other.
- Verify SDK surface against live docs (T056) before any live run — identifiers are version-sensitive (research D1/D2/D10).
- Commit after each task or logical group; use `/seed` to reset between demo takes.
