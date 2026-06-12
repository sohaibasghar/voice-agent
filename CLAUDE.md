<!-- SPECKIT START -->
Active feature: **Voice Front-Desk Agent** (`001-voice-front-desk-agent`).
Plan: `specs/001-voice-front-desk-agent/plan.md` — read it for stack, structure,
shell commands, and architecture decisions.

Stack: TypeScript/Node LTS · NestJS backend · Next.js (App Router) + shadcn/ui +
Tailwind frontend (voice/session/trace in 'use client' components) · shared Zod
package · OpenAI Agents SDK realtime (`@openai/agents` + `@openai/agents-realtime`,
WebRTC) · Prisma + SQLite.

Key invariants: OpenAI API key stays server-side (browser gets ephemeral `ek_`
tokens); tools are injectable NestJS providers with Zod I/O; guardrails
(no-double-book, confirm-before-destructive) enforced authoritatively server-side;
session runs in the browser over direct WebRTC with events relayed to NestJS for the
trace view; audio transport isolated for a future Twilio swap.
<!-- SPECKIT END -->
