<!--
SYNC IMPACT REPORT
==================
Version change: (template / unratified) → 1.0.0
Bump rationale: Initial ratification — first concrete constitution replacing the
placeholder template. MAJOR baseline.

Principles defined (5):
  I.   Secrets Stay Server-Side
  II.  Tools as Injectable, Testable Providers
  III. Authoritative Guardrails (NON-NEGOTIABLE)
  IV.  Traceability & Observability
  V.   Demo Reliability & Determinism

Sections:
  Added: "Technology & Architecture Constraints"
  Added: "Development Workflow & Quality Gates"
  Added: "Governance"

Templates / artifacts checked:
  ✅ .specify/templates/plan-template.md — "Constitution Check" defers generically
       to this file; no edit needed. Active plan already PASSes these gates.
  ✅ .specify/templates/spec-template.md — no new mandatory spec sections introduced;
       no edit needed.
  ✅ .specify/templates/tasks-template.md — not present in repo; principle-driven task
       types (guardrail tests, trace relay, seed/reset) will be reflected by /speckit.tasks.
  ✅ specs/001-voice-front-desk-agent/plan.md — Constitution Check section consistent
       (secrets server-side, injectable providers, authoritative guardrails, traceability,
       simplicity/determinism).

Deferred TODOs: none. Ratification date set to today (initial adoption).
-->

# Voice Front-Desk Agent Constitution

This constitution governs the Voice Front-Desk Agent — a browser voice agent for
salons/spas that is simultaneously a developer demo of the OpenAI Agents SDK and the
real core of a front-desk product. Both purposes are first-class: code is production
intent, not throwaway scaffolding.

## Core Principles

### I. Secrets Stay Server-Side

The OpenAI API key and all provider credentials MUST live only in the backend and MUST
NEVER reach the browser. The browser obtains access only via short-lived ephemeral
session tokens minted server-side, per session. No long-lived secret, database
credential, or privileged token may be embedded in, or recoverable from, client code or
client network traffic.

Rationale: The client is an untrusted environment; a leaked key is an unbounded
financial and security liability. Ephemeral tokens bound the blast radius to one short
session.

### II. Tools as Injectable, Testable Providers

Every tool's business logic MUST live in the backend as an injectable provider with
explicitly typed (Zod) input and output, unit-testable without invoking the model.
Client-side tool definitions MUST be thin proxies only — no business rules, no data
access, no secrets. Shared input/output schemas MUST be defined once and imported by both
sides so contracts cannot drift.

Rationale: This is both the product's real data layer and the demo's credibility. Logic
that can only be exercised through the model is untestable and unreliable; keeping it in
providers makes correctness verifiable and reusable beyond the demo.

### III. Authoritative Guardrails (NON-NEGOTIABLE)

Safety-critical rules MUST be enforced by the backend, not by trusting the model's
narration:

- **No double-booking**: booking and reschedule MUST reject any slot overlapping an
  existing confirmed booking and re-offer alternatives; they MUST NOT overwrite.
- **Confirm before destructive action**: cancel and reschedule MUST require an explicit
  in-conversation caller confirmation, enforced as a hard precondition the backend rejects
  when absent.
- **Grounded answers only**: hours, location, policies, prices, and packages MUST be
  served from stored data; the agent MUST NOT fabricate them.
- **Stay in domain**: off-topic requests are politely deflected back to booking/FAQ.

Rationale: "Trust the trace, not the agent's narration." A guardrail that lives only in a
prompt is not a guarantee. Authoritative server enforcement is what makes zero
double-bookings and zero unconfirmed deletions provable.

### IV. Traceability & Observability

Every run MUST produce an inspectable record showing each tool call with its arguments
and result, every handoff decision and branch, and every guardrail trip — reviewable
after the run. Where the runtime topology prevents automatic hosted tracing, the system
MUST relay session events to the backend and assemble an equivalent inspectable trace.
Structured logging of tool invocations and guardrail outcomes is required.

Rationale: The trace is the demo payoff and the operational truth source. If an action
cannot be traced, it cannot be trusted or debugged.

### V. Demo Reliability & Determinism

The system MUST be runnable reproducibly: seeded with realistic data, resettable to a
known state between runs via a single action, and operable on untrusted conference wifi.
Design MUST favor simplicity (YAGNI) — derive rather than store when feasible, and avoid
abstractions not required by current scope. The audio transport MUST be isolated behind a
seam so it can be swapped (e.g. to telephony) without changing agents, tools, guardrails,
or the data model. A pre-recorded fallback of the canonical run MUST exist for live demos.

Rationale: A live voice demo has many failure modes; determinism, a reset path, and a
fallback are what make it survivable. Transport isolation protects the investment when the
delivery channel changes.

## Technology & Architecture Constraints

- **Language/runtime**: TypeScript on Node LTS across backend and frontend.
- **Backend**: NestJS — owns secrets, business logic, the calendar store, and all
  authoritative guardrails. Persistence is SQLite via Prisma (survives restart so seeded
  bookings persist for live reschedule/cancel).
- **Frontend**: Next.js (App Router) + shadcn/ui + Tailwind CSS. Voice/session/WebRTC and
  trace code run in client components only.
- **Agent layer**: OpenAI Agents SDK realtime/voice (speech-to-speech) over WebRTC.
  Fast-moving SDK identifiers (package/import/class names, model ids, token endpoints,
  pricing) MUST be verified against current official docs before a live run, never trusted
  from memory.
- **Validation**: Zod for all tool I/O and structured outputs, schemas shared between
  client and server.
- **Cost control**: a single config switch selects model tier (cheap for dev,
  high-quality for live runs); a hard spend cap MUST be set in the provider dashboard.
- **Scope guard (v1)**: no telephony/PSTN, no payments, no multi-tenant/admin UI, no
  production auth/RBAC/data-retention tooling. These are documented future paths, not
  v1 work.

## Development Workflow & Quality Gates

- **Testability gate**: tool providers and guardrail logic MUST have unit tests that run
  without the model; the no-double-book and confirm-before-destructive rules MUST be
  covered by tests.
- **Contract gate**: any change to a tool's input/output MUST update the shared Zod schema
  and both consumers in the same change.
- **Secrets gate**: no PR may introduce a path by which a provider key or DB credential
  reaches the client; reviewers MUST verify the client only ever handles ephemeral tokens.
- **Determinism gate**: changes affecting demo data MUST keep `/seed` reset producing a
  known, runnable state including the pre-existing bookings.
- **Plan alignment**: feature plans MUST include a Constitution Check; violations MUST be
  justified in the plan's Complexity Tracking or the design changed to comply.

## Governance

This constitution supersedes other practices where they conflict. It applies to all work
on the Voice Front-Desk Agent, demo and product alike.

- **Amendments** MUST be made by editing this file, with a Sync Impact Report recorded at
  the top and dependent templates/docs updated in the same change.
- **Versioning** follows semantic versioning: MAJOR for backward-incompatible
  governance/principle removals or redefinitions; MINOR for a new principle/section or
  materially expanded guidance; PATCH for clarifications and non-semantic refinements.
- **Compliance review**: every PR and design review MUST verify adherence to the five
  principles, with special attention to the NON-NEGOTIABLE guardrail principle (III).
  Unjustified violations block merge.
- **Runtime guidance**: `CLAUDE.md` and the active feature plan provide day-to-day
  development context and MUST stay consistent with this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-06-12 | **Last Amended**: 2026-06-12
