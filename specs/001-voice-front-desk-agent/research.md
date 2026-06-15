# Phase 0 Research: Voice Front-Desk Agent

**Feature**: `001-voice-front-desk-agent`
**Date**: 2026-06-12
**Input**: spec.md + PRD-voice-front-desk-agent.md

All SDK facts below were verified against live official docs (`openai.github.io/openai-agents-js`, `developers.openai.com`, the `openai/openai-agents-js` repo) in June 2026, per the PRD's instruction not to trust this fast-moving surface from memory. Version-sensitive items are flagged.

---

## D1. OpenAI Agents SDK — package, classes, transport

- **Decision**: Use `@openai/agents` + `@openai/agents-realtime` (JS/TS). Browser realtime via `RealtimeAgent` + `RealtimeSession` with the `OpenAIRealtimeWebRTC` transport (default in browser). Validate with `zod`.
- **Rationale**: This is the current GA realtime surface; WebRTC transport auto-configures mic capture and audio playback, giving low-latency speech-to-speech and barge-in for free (FR-001, FR-002, SC-006).
- **Key identifiers** (verify on upgrade):
  - Install: `npm install @openai/agents @openai/agents-realtime zod`
  - Imports: `import { RealtimeAgent, RealtimeSession, OpenAIRealtimeWebRTC } from '@openai/agents/realtime'`
  - Tools: `import { tool } from '@openai/agents'`
  - Session constructor: `new RealtimeSession(agent, { model })` — agent is first positional arg.
  - Connect (browser): `await session.connect({ apiKey: 'ek_...' })`
- **Alternatives considered**: `OpenAIRealtimeWebSocket` server-side session (rejected — would proxy audio through NestJS, adding latency and the demo-fragile media bridge the PRD defers to the Twilio path). Stitched STT→LLM→TTS pipeline (rejected by PRD §12 — worse latency/interruption).
- **Flagged uncertainty**: `@openai/agents/realtime` vs standalone `@openai/agents-realtime` both resolve the same symbols — pick one import path consistently.

## D2. Ephemeral token minting (key stays server-side)

- **Decision**: NestJS `POST /session` calls `POST https://api.openai.com/v1/realtime/client_secrets` with the server-only `OPENAI_API_KEY`, body `{ "session": { "type": "realtime", "model": <tier> } }`, and returns the `ek_...` value to the browser. Mint fresh per session, just before `connect()`.
- **Rationale**: Satisfies FR-016 — the real `sk-...` key never reaches the browser; ephemeral tokens default to ~60s TTL.
- **Alternatives considered**: Legacy beta `POST /v1/realtime/sessions` + `OpenAI-Beta: realtime=v1` header (rejected — superseded by GA `client_secrets`).
- **Flagged uncertainty**: endpoint/body shape is version-sensitive; confirm on upgrade.

## D3. Session topology — DECISION (REVISED 2026-06-12)

- **Decision (revised)**: **Server-side `RealtimeSession`** (user-selected 2026-06-12, superseding the earlier browser-WebRTC choice). NestJS runs the OpenAI Agents SDK: it creates the `RealtimeSession` with the `OpenAIRealtimeWebSocket` transport (`useInsecureApiKey: true`, real key server-side), hosts the three `RealtimeAgent`s, executes tools **natively server-side** (tool `execute` calls the injected Nest providers directly — no HTTP proxy), runs the **output guardrail**, performs **handoffs**, and supports **human-in-the-loop tool approvals** (`session.approve/reject`). The browser is a thin audio+UI client: it captures mic PCM16 and streams it to NestJS over a Socket.IO `/voice` channel; NestJS feeds it via `session.sendAudio()` and streams output audio (`session.on('audio')`) back for playback. `session.interrupt()` + `audio_interrupted` drive barge-in.
- **Rationale**: The user wants the full server-side Agents SDK surface. This gives native server-side tool execution (Constitution II in full), **automatic hosted OpenAI traces** (Node runtime + real key → tracing on by default; the PRD payoff with zero extra work), and human-in-the-loop approvals on destructive actions. It is also the natural Twilio seam (PRD §16) — Twilio Media Streams would replace only the browser audio channel.
- **Cost (accepted)**: The browser↔NestJS audio bridge (PCM16 over WebSocket + Web Audio capture/playback + 24 kHz resampling) is the fiddly, demo-fragile plumbing the PRD flagged. Extra audio hop vs direct WebRTC. Mitigated by `/seed` + a rehearsed run + pre-recorded fallback.
- **Audio facts (verified against installed SDK)**: realtime audio is **PCM16 mono @ 24 kHz**. `session.sendAudio(ArrayBuffer)` feeds input; `session.on('audio', e => e.data: ArrayBuffer)` yields output; `session.interrupt()` stops playback. Approvals: `tool_approval_requested(context, agent, approvalRequest)` → `session.approve(approvalRequest.approvalItem)` / `session.reject(approvalItem, { message })`.
- **Tracing**: Automatic — the SDK traces in Node; tool calls, handoffs, guardrail trips, and approvals appear in the hosted dashboard. The UI ALSO shows a live relayed-event trace (events forwarded over `/voice`).
- **Note (`run()` vs realtime)**: The classic `run()`/`Runner` loop is the *text* SDK surface and is mutually exclusive with speech-to-speech. Realtime uses a live `RealtimeSession` instead of `run()`, but exposes Agent, tools, handoffs, output guardrails, and human-in-the-loop — which is what this feature uses.
- **Superseded alternative**: Direct browser WebRTC + event relay (original D3) — lowest latency/least plumbing, but tools + session run browser-side and the hosted trace is not automatic. Replaced per user request for the full server-side SDK.

## D4. Tools — definition, validation, execution

- **Decision**: Each tool is a NestJS provider (injectable, unit-testable) exposing the real logic, fronted by an HTTP endpoint under `/tools/*`. The browser declares a matching `tool()` with a Zod `parameters` schema whose `execute` POSTs to that endpoint. Shared Zod schemas live in a `shared/` package imported by both sides so input/output types stay in lockstep (FR-003..014).
- **Rationale**: `tool()` supports Zod natively; centralizing schemas prevents drift; provider isolation gives the testability the PRD requires (§12).
- **Tools**: `checkAvailability`, `lookupBooking` (FR-006a, by name+contact), `bookSlot`, `rescheduleBooking`, `cancelBooking`, `lookupFAQ`, `lookupServices`, `sendConfirmation`, `logCallback` (escalation, FR-013a).

## D5. Handoffs — multi-agent

- **Decision**: Three `RealtimeAgent`s — `FrontDeskAgent` (triage, default entry), `ServicesAgent` (pricing/packages/FAQ), `EscalationAgent` (logs callback). FrontDesk declares `handoffs: [servicesAgent, escalationAgent]`; each target carries a `handoffDescription`. Control returns to FrontDesk for continued booking (FR-012, FR-013a).
- **Rationale**: Handoffs work with `RealtimeAgent`; the live connection is preserved on handoff (no reconnect), keeping latency. Array-of-agents form confirmed in docs.
- **Flagged uncertainty**: `handoff()` wrapper vs bare-agent array for per-handoff overrides — use bare array unless overrides needed.

## D6. Guardrails — confirm-before-destructive + no-double-book + stay-in-domain

- **Decision**: Two layers.
  1. **Output guardrail** (`RealtimeOutputGuardrail` in the browser session) — "stay in domain" deflection.
  2. **Server-side enforcement** (authoritative) — `bookSlot`/`rescheduleBooking` reject overlaps in the NestJS provider (no double-book, FR-006); `cancelBooking`/`rescheduleBooking` require an explicit `confirmed: true` flag the agent only sets after the caller confirms in-turn — the provider rejects unconfirmed destructive calls (FR-009). This makes the guardrail authoritative regardless of model behavior.
- **Rationale**: A purely model-side guardrail is not trustworthy ("trust the trace, not the narration" — PRD §5). Enforcing in the provider guarantees SC-003/SC-005. The guardrail trip is relayed and shown in the trace.
- **Flagged uncertainty**: exact `RealtimeOutputGuardrail` method/return field names (`execute` + `{ tripwireTriggered, outputInfo }`) — confirm on interface ref page.

## D7. Persistence — SQLite via Prisma

- **Decision**: SQLite as the calendar store, accessed through Prisma (clarification 2026-06-12). Entities: Service, Booking, FAQ, CallbackRequest. Availability is **derived** (business hours minus overlapping confirmed bookings), not stored as Slot rows.
- **Rationale**: Survives restart so seeded pre-existing bookings persist for live reschedule/cancel (FR-018, SC-009). Prisma gives typed access and an easy `/seed` reset.
- **Alternatives considered**: in-memory (rejected — clarification chose SQLite); SQL by hand (rejected — Prisma is faster and typed).

## D8. Slot/availability model

- **Decision**: Fixed daily business hours (config). Candidate slots are the requested service's `durationMin` long, generated on a step granularity (e.g. 15 min). A slot is open iff `[start, start+duration)` overlaps no `confirmed` booking. `checkAvailability` filters by `partOfDay` when given (clarification 2026-06-12, FR-003).
- **Rationale**: Simplest faithful model; makes no-double-book a clean interval-overlap check.

## D9. Tracing/observability for the demo payoff

- **Decision**: Per-session trace assembled in NestJS from relayed `/realtime` events: ordered list of tool calls (name, args, result), handoff branches, guardrail trips, timestamps. Exposed for the UI trace view and dumped to logs. Server-side SDK tracing enabled (`OPENAI_API_KEY` present) so hosted dashboard captures any NestJS-side spans; the primary demo artifact is the relayed-event view (see D3).
- **Rationale**: Guarantees FR-015/SC-007 independent of browser tracing limitations.

## D10. Model-tier config

- **Decision**: Single env flag `OPENAI_REALTIME_MODEL` (or `MODEL_TIER=dev|live` mapping). Dev/cheap: `gpt-realtime-mini`. Live/high-quality: `gpt-realtime-2`. Hard spend cap set in the OpenAI dashboard (FR-019, PRD §13).
- **Flagged uncertainty**: model ids and pricing are the most volatile facts — confirm `gpt-realtime-2` / `gpt-realtime-mini` strings and rates at platform.openai.com before the live run.

## D11. Stack, structure, testing

- **Decision**: TypeScript on Node LTS. Backend NestJS. Frontend **Next.js (App Router) + shadcn/ui + Tailwind CSS**; the RealtimeSession, WebRTC transport, tool proxies, and trace view live in `'use client'` components (the SDK session and WebRTC are browser-only). Shared Zod schemas in a `shared/` workspace. Tests: Jest (NestJS default) for provider/guardrail unit tests + booking-engine integration tests against a temp SQLite DB.
- **Rationale**: A browser client is required because the chosen topology (D3) runs the session in the browser — it needs mic/speaker controls and the trace view (the demo payoff). Next.js + shadcn/Tailwind gives a fast, presentable UI for the on-stage demo. Provider unit tests cover tools and guardrail logic independently of the model (FR/SC testability, PRD §12). NestJS stays the only holder of secrets and business logic; Next.js serves the client only.
- **Alternatives considered**: Vite + vanilla/React (rejected — user chose Next.js/shadcn/Tailwind). Using Next.js API routes for `/session` (rejected — keep all server logic in NestJS for one authoritative backend; the browser calls NestJS directly).
- **Gotcha**: Voice/session code must be client components; do not import `@openai/agents-realtime` into server components or route handlers.

## D12. API surface & Twilio seam

- **Decision**: `POST /session`, `WS /realtime`, `GET /health`, `POST /seed`, plus `/tools/*` endpoints. The audio transport is isolated behind a client-side transport seam so swapping browser-WebRTC for Twilio Media Streams later does not touch agents, tools, guardrails, or data model (PRD §16).

---

## Constitution note

`.specify/memory/constitution.md` is the unpopulated template (placeholder principles, no ratified version). No concrete gates are defined, so the Constitution Check is non-binding for this plan. When the project constitution is ratified (via `/speckit.constitution`), re-run the gate check. The plan independently honors common-sense gates: server-side secrets, injectable/testable providers, simplicity (derive availability rather than store slots, no premature multi-tenant abstraction).

## Resolved unknowns

All Technical Context items that were "NEEDS CLARIFICATION" are resolved above: SDK package/classes (D1), token minting (D2), session topology + tracing approach (D3, D9), tool execution (D4), persistence (D7), model tier (D10). No open NEEDS CLARIFICATION remain.
