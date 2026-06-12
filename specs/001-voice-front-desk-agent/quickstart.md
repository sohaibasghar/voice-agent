# Quickstart: Voice Front-Desk Agent

**Feature**: `001-voice-front-desk-agent`

## Prerequisites
- Node LTS, npm
- An OpenAI API key with Realtime access
- Set a **hard spend cap** in the OpenAI dashboard before any live run (PRD §13)

## Setup
```bash
# from repo root
npm install                      # workspaces: backend, frontend, shared
cp backend/.env.example backend/.env
# edit backend/.env:
#   OPENAI_API_KEY=sk-...                 (server-only, never shipped to browser)
#   MODEL_TIER=dev                        (dev → gpt-realtime-mini, live → gpt-realtime-2)
#   DATABASE_URL=file:./demo.db
#   BUSINESS_HOURS=09:00-18:00
#   BUSINESS_DAYS=Mon-Sat

# init + seed the SQLite store
npm run -w backend prisma:migrate
npm run -w backend seed           # or POST /seed once running
```

## Run
```bash
npm run -w backend start:dev      # NestJS on :3000  (/session, /realtime, /health, /seed, /tools/*)
npm run -w frontend dev           # Next.js client on :3001
# open http://localhost:3001, click "Talk", allow mic
# NEXT_PUBLIC_BACKEND_URL=http://localhost:3000 in frontend/.env.local
```

## Verify the demo beats
1. **Health**: `curl localhost:3000/health` → `{ "status": "ok", ... }`
2. **Token**: `curl -XPOST localhost:3000/session` → `{ "value": "ek_...", ... }` (must be `ek_`, never `sk-`)
3. **Happy path (US1)**: say "haircut Thursday afternoon" → agent offers slots → pick one → give name + phone → hear confirmation + "WhatsApp sent". Confirm a `confirmed` booking row exists matching the read-back (SC-002).
4. **Barge-in (FR-002)**: interrupt mid-sentence → agent stops.
5. **Guardrail (US2)**: "cancel my Thursday booking" → agent must ask to confirm; an unconfirmed `cancelBooking` is rejected `not_confirmed` and shows as a `guardrail_trip` in the trace (SC-005).
6. **No double-book (SC-003)**: try to book an occupied slot → `slot_taken` → agent re-offers.
7. **Handoff (US3)**: "do you do bridal packages and how much?" → handoff to ServicesAgent → grounded price (no fabrication, SC-004).
8. **Escalation (FR-013a)**: "can a human call me back?" → handoff to EscalationAgent → `logCallback` writes a CallbackRequest.
9. **Trace (US4)**: open the trace view → ordered tool calls (args+results), handoff branch, guardrail trip all visible (SC-007).

## Reset between takes
```bash
curl -XPOST localhost:3000/seed   # restores known state incl. pre-existing bookings (SC-009)
```

## Live-run switches
- `MODEL_TIER=live` for `gpt-realtime-2` (confirm exact model id + pricing at platform.openai.com first).
- Keep a **pre-recorded screencast** of the full run as conference-wifi fallback (PRD §15).

## Tests
```bash
npm run -w backend test           # provider + guardrail unit tests, booking-engine integration (temp SQLite)
```
Targets: no-double-book overlap logic, `not_confirmed` rejection on destructive ops, availability derivation, FAQ/Services groundedness.
