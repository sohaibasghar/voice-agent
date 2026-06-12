# PRD — Voice Front-Desk Agent (Salon & Spa)

**Status:** Draft v1
**Owner:** Sohaib
**Last updated:** 11 Jun 2026
**Stack:** OpenAI Agents SDK (Realtime / speech-to-speech) · NestJS · TypeScript · Zod · WebRTC

---

## 1. Summary

A browser-based voice agent that answers as the front desk of a salon or spa. A caller speaks into the browser and the agent books, reschedules, and cancels appointments, and answers common questions — out loud, in real time, with natural turn-taking and interruption handling.

This artifact serves **two purposes at once**, and every requirement below is judged against both:

1. **Developer demo.** Show the OpenAI Agents SDK primitives — tools, handoffs, guardrails, and especially *traces* — working in a real backend (NestJS), live in front of engineers.
2. **Product prototype.** This is the voice version of the front-desk SaaS, so the work is not throwaway. The agent logic, tools, and data model are the real ones, not demo scaffolding.

**Scope decision (locked):** Browser voice via WebRTC. **No telephony in v1.** Twilio "the phone actually rings" is a documented future path (§16), architected for but not built. This removes the single biggest live-demo failure mode while keeping the wow factor high for a developer audience.

---

## 2. Background & problem

Local service businesses lose bookings to missed calls and after-hours enquiries. A front desk that never sleeps, books directly into the calendar, and confirms over the caller's preferred channel is the core value driver. The conversational layer is the visible surface; the **reliable calendar + booking engine underneath is the actual product** — the voice agent is a thin, impressive shell over it.

For the demo specifically: developers have seen text chatbots. A low-latency *voice* agent that visibly calls tools and produces an inspectable trace is memorable in a way a text demo is not.

---

## 3. Goals & non-goals

### Goals
- A caller can complete a booking end-to-end by voice, with the slot written to a real calendar store.
- Reschedule and cancel flows work, with a confirmation guardrail before any destructive action.
- FAQ answers (hours, pricing, location, services) are grounded, not hallucinated.
- The full interaction is **traceable** — every tool call, handoff, and guardrail trip is visible after the run.
- Live demo runs reliably on conference wifi without a telephony dependency.

### Non-goals (v1)
- Real phone calls / PSTN / Twilio.
- Payments or deposits.
- Multi-location or multi-tenant management UI.
- Staff/calendar admin interface (we seed data directly).
- Production auth, RBAC, GDPR/data-retention tooling.
- Outbound calling (reminders are logged/mocked, not actually dialed).

---

## 4. Users & personas

| Persona | Context | What they need from the agent |
|---|---|---|
| **Caller (end user)** | Wants to book/change an appointment by voice | Fast, natural conversation; correct slot; clear confirmation |
| **Developer (demo audience)** | Evaluating the SDK and the architecture | To *see* tools fire, handoffs decide, guardrails trip, and the trace |
| **Sohaib (operator/founder)** | Running the demo, building the SaaS | Reliable live run; reusable, real product code |

---

## 5. Demo narrative (the on-stage script)

The demo is a deliverable in its own right. Target length: **4–6 minutes.**

1. **Happy path (90s).** "Hi, I'd like a haircut Thursday afternoon." → agent calls `checkAvailability` → offers two slots → caller picks one → `bookSlot` → spoken confirmation + "I've sent a WhatsApp confirmation." Audience hears natural turn-taking; you interrupt mid-sentence to show barge-in.
2. **Handoff (60s).** "Actually, do you do bridal packages and how much?" → triage agent **hands off** to a `ServicesAgent` with its own FAQ/pricing tools. Call out the handoff decision verbally.
3. **Guardrail (45s).** "Cancel my Thursday booking." → agent must **confirm explicitly** before calling `cancelBooking`; show the guardrail blocking an unconfirmed destructive action.
4. **The payoff — the trace (90s).** Open the trace dashboard. Walk through: which tools fired, with what arguments, the handoff branch, where the guardrail tripped. **This is the moment that lands.** Reinforce the mental model: trust the trace, not the agent's narration.

Keep a **pre-recorded fallback** of this exact run (see Risks, §15).

---

## 6. Functional requirements

### 6.1 Agents
- **Front-Desk (triage) agent** — default entry point. Greets, understands intent, books/reschedules/cancels, routes to specialists.
- **Services agent** — handles detailed service/pricing/package questions via FAQ tools. Reached by handoff.
- (Optional stretch) **Escalation agent** — "let me take a message for a human," logs a callback request. Nice for showing a third handoff branch; cut if time-constrained.

### 6.2 Tools
All tools are NestJS providers (injectable, unit-testable). Each has a Zod-typed input and output.

| Tool | Input (Zod) | Behaviour |
|---|---|---|
| `checkAvailability` | `{ service, date, partOfDay? }` | Returns open slots from the calendar store |
| `bookSlot` | `{ service, startTime, customerName, contact }` | Writes booking; returns confirmation id. **Rejects double-book.** |
| `rescheduleBooking` | `{ bookingId, newStartTime }` | Moves a booking; validates new slot is free |
| `cancelBooking` | `{ bookingId }` | Cancels. **Gated by confirmation guardrail.** |
| `lookupFAQ` | `{ topic }` | Returns grounded answer (hours, location, policies) |
| `lookupServices` | `{ query }` | Returns service/pricing/package info |
| `sendConfirmation` | `{ contact, bookingId }` | v1: logs/mocks a WhatsApp/SMS send; returns ok |

### 6.3 Guardrails
- **No double-booking.** `bookSlot` and `rescheduleBooking` validate against current bookings; on conflict, the agent must re-offer rather than overwrite.
- **Confirm before destructive action.** `cancelBooking` (and reschedule) require explicit caller confirmation in the turn. An output/tool guardrail blocks the call if confirmation isn't present, forcing the agent to ask first.
- **Stay in domain.** Politely deflect off-topic requests back to booking/FAQ.

### 6.4 Conversation behaviour
- Natural turn-taking with **barge-in** (caller can interrupt; agent stops talking).
- Always **read back** the booking (service, day, time) before finalizing.
- Spoken confirmations are concise; the "receipt" detail goes to the confirmation channel.

---

## 7. System architecture

```
┌─────────────┐     WebRTC (audio)      ┌─────────────────────┐
│   Browser    │ ◄────────────────────► │  OpenAI Realtime     │
│  client      │                        │  (speech-to-speech)  │
│ (mic/speaker)│                        └─────────┬───────────┘
└──────┬───────┘                                  │ tool calls
       │ 1. request ephemeral token               │ resolved via
       │ 2. signaling / events (WS)               │ backend
       ▼                                          ▼
┌──────────────────────────────────────────────────────────────┐
│  NestJS backend                                                │
│  • /session  → mints EPHEMERAL token (API key stays server)    │
│  • WS Gateway → signaling + event relay                        │
│  • Tools as providers: checkAvailability, bookSlot, …          │
│  • Agents: FrontDeskAgent ⇄ ServicesAgent (handoff)            │
│  • Guardrails                                                  │
│  • CalendarStore (in-memory / SQLite for demo)                 │
└──────────────────────────────────────────────────────────────┘
```

**Key principles**
- **API key never reaches the browser.** Backend mints short-lived ephemeral session tokens.
- **Tools resolve server-side** so business logic and data stay in NestJS and remain injectable/testable.
- **Provider abstraction:** wrap the model/session behind an interface so the realtime provider (and later, the transport) can change without touching agent or tool code.
- **Twilio-ready seam:** the audio transport is isolated. Swapping browser-WebRTC for Twilio Media Streams should not require rewriting agents, tools, or guardrails (§16).

---

## 8. Technical requirements

- **Language/runtime:** TypeScript, Node LTS, NestJS.
- **Agent layer:** OpenAI Agents SDK realtime/voice (`RealtimeAgent` / `RealtimeSession` style, speech-to-speech model). ⚠️ **Verify exact package names, imports, and the WebRTC transport setup against current docs** — this surface has moved quickly and should not be trusted from memory. The architecture here is stable regardless of the exact import lines.
- **Validation:** Zod for all tool I/O and structured outputs.
- **Transport:** WebRTC browser↔OpenAI; NestJS WebSocket gateway for signaling/events.
- **Persistence:** in-memory store (or SQLite via Prisma if you want bookings to survive a restart during the demo). Seed with realistic salon data.
- **Tracing:** OpenAI hosted trace dashboard — included, no extra cost, and it's the demo payoff.
- **Config:** single env flag to switch model tier (cheap default, high-quality for the live run) and, later, transport.

---

## 9. Data model (demo-scale)

```ts
type Service   = { id; name; durationMin; price };
type Slot      = { startTime; endTime; staffId? };
type Booking   = {
  id; serviceId; startTime; endTime;
  customerName; contact; status: 'confirmed'|'cancelled';
};
type FAQ       = { topic; answer };
```

Seed: ~5 services (haircut, color, manicure, facial, bridal package), a week of availability, a handful of FAQs, 1–2 pre-existing bookings so reschedule/cancel have something to act on live.

---

## 10. API surface (NestJS)

| Method | Route | Purpose |
|---|---|---|
| `POST` | `/session` | Mint ephemeral realtime session token |
| `WS` | `/realtime` | Signaling + event relay (tool events, handoff/guardrail events for the UI) |
| `GET` | `/health` | Liveness for the demo box |
| `POST` | `/seed` | Reset demo data to a known state between runs |

A `/seed` reset endpoint is worth the 20 minutes — it lets you re-run the demo cleanly if the first take goes sideways.

---

## 11. Conversation design (reference dialogue)

> **Caller:** Hi, can I get a haircut sometime Thursday afternoon?
> **Agent:** *(checkAvailability)* I've got 2:00 or 4:30 on Thursday — which works?
> **Caller:** 4:30.
> **Agent:** Great — and your name?
> **Caller:** Ayesha.
> **Agent:** *(bookSlot)* Booked: haircut, Thursday 4:30 with Ayesha. I'll send a WhatsApp confirmation. Anything else?
> **Caller:** Do you do bridal packages?
> **Agent:** *(handoff → ServicesAgent → lookupServices)* We do — our bridal package is …

---

## 12. Non-functional requirements

- **Latency:** perceived response start < ~1s; barge-in feels instant. (This is *why* we use speech-to-speech rather than a stitched STT→agent→TTS pipeline — the pipeline's latency and interruption handling are visibly worse on stage.)
- **Reliability on stage:** must run on untrusted conference wifi; pre-recorded fallback ready.
- **Determinism for demo:** seeded data + reset endpoint so each run is reproducible.
- **Testability:** tools unit-tested independently of the model; guardrail logic covered.

---

## 13. Cost & budget

- **Realtime/audio tokens cost meaningfully more than text tokens.** Still demo-scale, not scary, but a few minutes of back-and-forth adds up faster than a text demo.
- Use the cheaper model tier for development; flip to the high-quality tier only for live runs (env flag).
- **Set a hard spend cap** in the dashboard so a runaway loop can't surprise you.
- ⚠️ **Exact realtime pricing shifts — confirm current numbers at platform.openai.com/pricing before committing.** Don't trust a figure from memory here.
- Free routes (local models via Ollama) exist but trade away clean tool-calling reliability and the hosted trace dashboard — the two things this demo depends on. Not recommended for the live run.

---

## 14. Success metrics

**Demo success**
- Happy-path booking completes live without intervention.
- Handoff and guardrail both visibly fire.
- Trace walkthrough lands — audience can follow tool calls → handoff → guardrail.

**Product-signal success**
- Booking write correctness: 100% of confirmed bookings match what was spoken back.
- Zero double-bookings across test runs.
- FAQ groundedness: no fabricated hours/prices in a 20-run test set.

---

## 15. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Conference wifi drops / latency spikes mid-demo | **Pre-recorded screencast** of the exact run as fallback; rehearse the cutover |
| Realtime SDK API differs from memory | Verify against current docs *before* building; isolate behind provider interface |
| Agent hallucinates prices/hours | All FAQ/pricing via `lookupServices`/`lookupFAQ`; no free-form answers |
| Destructive action without confirmation | Confirmation guardrail on cancel/reschedule |
| Runaway token spend | Hard spend cap + cheap dev tier |
| First take goes wrong live | `/seed` reset endpoint to re-run cleanly |

---

## 16. Future path — making the phone actually ring (Twilio)

Architected for, **not built in v1.** When wanted: replace the browser-WebRTC transport with Twilio Media Streams (audio over WebSocket) bridged to the OpenAI realtime socket. **Agents, tools, guardrails, and data model stay unchanged** — only the transport seam swaps. Adds: a rented number, per-minute telephony cost, and the media-bridge plumbing (the fiddliest and most demo-fragile part — which is exactly why it's out of v1).

Other future work: real WhatsApp/SMS confirmations (replace the mocked `sendConfirmation`), outbound reminders, multi-tenant onboarding, deposits/payments.

---

## 17. Milestones

| Phase | Deliverable |
|---|---|
| **M0 — Spike (½–1 day)** | Verify realtime SDK + WebRTC against current docs; bare browser↔agent voice loop, no tools |
| **M1 — Core booking** | Tools as providers, `checkAvailability` + `bookSlot`, seeded data, spoken confirmation |
| **M2 — Reschedule/cancel + guardrails** | Destructive-action confirmation, no-double-book |
| **M3 — Handoff** | Services agent + handoff; FAQ grounding |
| **M4 — Demo polish** | `/seed` reset, trace walkthrough rehearsed, pre-recorded fallback, model-tier flag |

---

## 18. Open questions

1. **Persistence:** in-memory (simplest) vs SQLite (survives restart)? Recommend SQLite if you'll show reschedule on a *pre-existing* booking.
2. **Third handoff (escalation/callback agent):** include for a richer trace, or cut for time? Recommend include only if M4 has slack.
3. **Audience depth:** do they want a code walkthrough after the live run? If yes, budget a few extra minutes and keep the tool-as-provider files tidy for screen-sharing.
