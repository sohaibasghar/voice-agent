# Implementation Plan: Voice Front-Desk Agent (Salon & Spa)

**Branch**: `001-voice-front-desk-agent` | **Date**: 2026-06-12 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-voice-front-desk-agent/spec.md`

## Summary

A browser voice agent that answers as a salon/spa front desk and books, reschedules, cancels appointments and answers grounded FAQ/pricing — in real time with barge-in. It is simultaneously a developer demo (visible tools, handoffs, guardrails, and an inspectable trace) and the real product core.

**Technical approach** (from research.md D3, revised 2026-06-12): the OpenAI Agents SDK runs **server-side** in NestJS — it hosts the `RealtimeSession` (`OpenAIRealtimeWebSocket`, real key server-side), the three `RealtimeAgent`s (FrontDesk ⇄ Services ⇄ Escalation via handoffs), tools that execute natively against the injected providers, the output guardrail, and **human-in-the-loop** tool approvals on destructive actions. NestJS owns the SQLite calendar store and the authoritative guardrails (no-double-book, confirm-before-destructive). The browser is a thin client: it streams mic PCM16 to the `/voice` Socket.IO gateway and plays back agent audio; it renders the trace + approvals UI from forwarded events. Tracing is automatic (Node runtime → hosted OpenAI dashboard). The browser↔NestJS audio channel is isolated so Twilio Media Streams can replace it later without touching agents/tools/guardrails/data model.

## Technical Context

**Language/Version**: TypeScript, Node LTS
**Primary Dependencies**: `@openai/agents` + `@openai/agents-realtime` (realtime/voice, WebRTC transport), NestJS, Prisma, Zod; frontend Next.js (App Router) + shadcn/ui + Tailwind CSS
**Storage**: SQLite via Prisma (clarification 2026-06-12) — survives restart for live reschedule/cancel of seeded bookings
**Testing**: Jest (NestJS) — provider/guardrail unit tests + booking-engine integration tests against a temp SQLite DB
**Target Platform**: Modern desktop browser (mic/speaker) + Node server on a demo box / conference wifi
**Project Type**: Web application (Next.js frontend + NestJS backend + shared schema package)
**Performance Goals**: perceived response start < ~1s; barge-in feels instant (SC-006) — achieved via direct browser↔OpenAI WebRTC speech-to-speech
**Constraints**: OpenAI API key never reaches the browser (FR-016); no telephony in v1; demo-deterministic via seed + `/seed` reset; hard spend cap set in dashboard
**Scale/Scope**: Single-tenant, single-location demo; ~5 services, a week of availability, handful of FAQs, 1–2 seeded bookings; one concurrent caller per demo run

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution v1.0.0 (ratified 2026-06-12) defines five binding principles. This design satisfies all of them (initial and post-design):

- **I. Secrets Stay Server-Side**: real key only in NestJS `/session`; browser gets ephemeral `ek_` tokens, never `sk-` (FR-016). ✓
- **II. Tools as Injectable, Testable Providers**: every tool is a NestJS provider with shared Zod I/O, unit-testable without the model; browser tools are thin proxies (research D4). ✓
- **III. Authoritative Guardrails (NON-NEGOTIABLE)**: no-double-book (`slot_taken`) and confirm-before-destructive (`not_confirmed`) enforced in providers, not model-trusted; FAQ/Services answers grounded in stored rows (research D6, contracts/tools.md). ✓
- **IV. Traceability & Observability**: per-session trace assembled in NestJS from relayed `/realtime` events (tool calls, handoffs, guardrail trips); the chosen browser topology can't auto-host traces, so the relay path satisfies the principle explicitly (research D3/D9). ✓
- **V. Demo Reliability & Determinism**: SQLite seed + `/seed` reset; availability derived not stored (YAGNI); WebRTC audio transport isolated behind a seam for the future Twilio swap; pre-recorded fallback required (research D3/D8/D12). ✓

→ **PASS** (initial and post-design). No entries in Complexity Tracking.

## Project Structure

### Documentation (this feature)

```text
specs/001-voice-front-desk-agent/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions D1..D12
├── data-model.md        # Phase 1 — entities, invariants, seed
├── quickstart.md        # Phase 1 — setup, run, verify the demo beats
├── contracts/
│   ├── tools.md         # Zod I/O for the 9 tools + guardrail contract
│   └── http-ws.md       # /session, /realtime, /health, /seed, transport seam
└── tasks.md             # Phase 2 — created by /speckit.tasks (NOT here)
```

### Source Code (repository root)

```text
backend/                         # NestJS — logic, data, secrets, guardrails
├── src/
│   ├── session/                 # POST /session — ephemeral token minting (OpenAIService wraps key)
│   ├── realtime/                # WS /realtime gateway — event relay + per-session trace assembly
│   ├── tools/                   # one provider per tool (injectable, Zod-validated)
│   │   ├── availability.service.ts   # checkAvailability (derive slots)
│   │   ├── booking.service.ts        # lookupBooking, bookSlot, reschedule, cancel (overlap + confirm guards)
│   │   ├── faq.service.ts            # lookupFAQ, lookupServices (grounded)
│   │   ├── confirmation.service.ts   # sendConfirmation (mock WhatsApp/SMS)
│   │   ├── callback.service.ts       # logCallback (escalation)
│   │   └── tools.controller.ts       # POST /tools/*
│   ├── calendar/                # CalendarStore over Prisma; business-hours config
│   ├── seed/                    # POST /seed reset + seed data
│   ├── health/                  # GET /health
│   └── config/                  # env, MODEL_TIER → model id mapping
├── prisma/schema.prisma         # Service, Booking, FAQ, CallbackRequest
└── test/                        # Jest unit + integration (temp SQLite)

frontend/                        # Next.js (App Router) browser voice client
├── app/
│   ├── page.tsx                 # demo page (server component shell)
│   ├── layout.tsx               # Tailwind + theme
│   └── globals.css              # Tailwind directives
├── components/
│   ├── ui/                      # shadcn/ui primitives (button, card, badge, etc.)
│   ├── voice-console.tsx        # 'use client' — Talk control, mic state, transcript
│   ├── slot-cards.tsx           # offered slots / booking read-back
│   └── trace-panel.tsx          # 'use client' — live tool/handoff/guardrail trace view
├── lib/
│   ├── transport/               # WebRTC transport seam (Twilio-swappable)
│   ├── agents/                  # FrontDesk / Services / Escalation RealtimeAgents + handoffs
│   ├── tools/                   # tool() defs (Zod) — thin proxies to /tools/*
│   ├── guardrails/              # output guardrail (stay-in-domain)
│   ├── trace/                   # event relay to /realtime
│   └── session.ts               # session lifecycle: GET /session → connect(ek_)
├── components.json              # shadcn/ui config
└── tailwind.config.ts

shared/                          # Shared Zod schemas (tool I/O, event types)
└── src/schemas.ts
```

**Structure Decision**: Web application — a NestJS `backend/` (authoritative logic, data, secrets, guardrails), a Next.js `frontend/` (App Router; voice/session/trace code in `'use client'` components since the SDK session and WebRTC are browser-only), and a `shared/` workspace holding the Zod contracts both import so tool I/O cannot drift. UI is shadcn/ui on Tailwind. This mirrors the PRD architecture (§7) and isolates the audio transport for the future Twilio path (§16). Next.js serves only the client; all secrets and business logic remain in NestJS (the browser calls `/session` and `/tools/*`).

## Complexity Tracking

No constitution violations to justify (constitution is an unratified template; see Constitution Check). Table intentionally empty.
