# HTTP / WebSocket Contracts (NestJS)

**Feature**: `001-voice-front-desk-agent`

## POST /session  — mint ephemeral realtime token (FR-016)
- **In**: `{}` (optional `{ modelTier?: 'dev' | 'live' }`)
- **Behaviour**: server calls `POST https://api.openai.com/v1/realtime/client_secrets` with the server-only `OPENAI_API_KEY`, body `{ session: { type: 'realtime', model: <resolved model id> } }`.
- **Out**: `{ value: string /* ek_... */; model: string; expiresAt: string }`
- Real `sk-...` key never leaves the server. Token TTL ~60s — mint per session.

## WS /realtime  — signaling + event relay
- Client → server messages (relayed session events for UI/trace, research.md D9):
  - `{ type: 'tool_call', sessionId, name, args, ts }`
  - `{ type: 'tool_result', sessionId, name, result, ts }`
  - `{ type: 'handoff', sessionId, from, to, ts }`
  - `{ type: 'guardrail_trip', sessionId, name, detail, ts }`
- Server → client (optional): `{ type: 'ack' }`, `{ type: 'trace_snapshot', events: TraceEvent[] }`
- Server persists/holds the ordered TraceEvent list per `sessionId` for the trace view.

## GET /health  — liveness (PRD §10)
- **Out**: `{ status: 'ok'; db: 'ok' | 'down'; ts: string }`

## POST /seed  — reset demo data to known state (FR-017, SC-009)
- **In**: `{}` (optional `{ profile?: 'default' }`)
- **Behaviour**: wipe + reseed Services, FAQs, business-hours config, and 1–2 pre-existing Bookings; clear CallbackRequests and confirmation log.
- **Out**: `{ ok: true; counts: { services; faqs; bookings } }`

## /tools/* — tool endpoints
See `tools.md`. Each `POST /tools/<name>` validates input against the shared Zod schema and returns the typed output. These hold the authoritative business logic and guardrail enforcement.

## Transport seam (Twilio-ready — PRD §16)
The browser-side audio transport (`OpenAIRealtimeWebRTC`) is isolated behind a client transport interface. Swapping to Twilio Media Streams later changes only that seam; `/session`, `/tools/*`, agents, guardrails, and data model are unchanged.
