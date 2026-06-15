<!-- SPECKIT START -->
Active feature: **Voice Front-Desk Agent** (`001-voice-front-desk-agent`).
Plan: `specs/001-voice-front-desk-agent/plan.md` — read it for stack, structure,
shell commands, and architecture decisions.

Stack: TypeScript/Node LTS · NestJS backend · Next.js (App Router) + shadcn/ui +
Tailwind frontend (voice/session/trace in 'use client' components) · shared Zod
package · OpenAI Agents SDK realtime (`@openai/agents` + `@openai/agents-realtime`,
WebRTC) · Prisma + SQLite.

Topology (revised — research.md D3): the OpenAI Agents SDK runs SERVER-SIDE.
NestJS hosts the `RealtimeSession` (`OpenAIRealtimeWebSocket`, `useInsecureApiKey`,
real key server-side), the three `RealtimeAgent`s, tools (execute = injected
providers directly), output guardrail, handoffs, and human-in-the-loop tool
approvals (`session.approve/reject`). The browser is a thin client: captures mic
PCM16 @24kHz and streams it to the `/voice` Socket.IO gateway, plays back the
agent audio, and renders trace + approval UI.

Key invariants: API key stays server-side; tools are injectable NestJS providers
with Zod I/O; guardrails (no-double-book, confirm-before-destructive) enforced
authoritatively in providers; destructive tools also gated by human approval;
tracing is automatic (Node) → hosted OpenAI dashboard; audio channel isolated for
a future Twilio Media Streams swap.
Backend voice code: `src/realtime/voice-agents.service.ts` + `voice.gateway.ts`.
Frontend audio client: `frontend/lib/voice-client.ts` + `lib/audio.ts` +
`public/capture-worklet.js`.
<!-- SPECKIT END -->
