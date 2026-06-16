# Voice Front-Desk Agent

A real-time voice agent that acts as the front desk for an appointment-based
business (default preset: a beauty salon). A caller speaks to the agent in
natural language to check availability, book, reschedule, or cancel
appointments, ask FAQs, and request a human callback. Destructive actions are
gated by authoritative guardrails plus human-in-the-loop approval.

## Architecture

The [OpenAI Agents SDK](https://github.com/openai/openai-agents-js) runs
**server-side**. NestJS hosts the `RealtimeSession`, the three `RealtimeAgent`s
(FrontDesk ⇄ Services ⇄ Escalation via handoffs), the tools, the output
guardrail, and tool-approval flow. The browser is a **thin client**: it captures
mic audio (PCM16 @ 24 kHz), streams it to the `/voice` Socket.IO gateway, plays
back the agent's audio, and renders the trace + approval UI.

```
Browser (Next.js)                     NestJS backend
┌──────────────────────┐  Socket.IO  ┌───────────────────────────────────┐
│ mic → PCM16 capture   │ ──/voice──▶ │ VoiceGateway → RealtimeSession     │
│ agent audio playback  │ ◀────────── │   ├─ RealtimeAgents (handoffs)     │
│ trace + approval UI    │  /session  │   ├─ tools (injected providers)    │   OpenAI
└──────────────────────┘             │   ├─ output guardrail              │ ◀─ Realtime
                                       │   └─ HITL tool approvals           │     API
                                       │ Prisma ──▶ PostgreSQL (calendar)   │
                                       └───────────────────────────────────┘
```

- **API key stays server-side** — never shipped to the browser.
- **Tools** are injectable NestJS providers with Zod-typed I/O.
- **Guardrails** (no-double-book, confirm-before-destructive) enforced
  authoritatively in the providers; destructive tools also require human
  approval.
- **Audio transport is isolated** behind the `/voice` gateway so Twilio Media
  Streams can replace the browser channel later without touching
  agents/tools/guardrails/data.

See `specs/001-voice-front-desk-agent/plan.md` for the full design and
`docs/` for additional notes.

## Stack

| Layer    | Tech                                                                 |
| -------- | -------------------------------------------------------------------- |
| Backend  | TypeScript · NestJS 11 · OpenAI Agents SDK (realtime, WebSocket)     |
| Frontend | Next.js (App Router) · shadcn/ui · Tailwind                          |
| Shared   | `voice-agent-shared` — Zod schemas + types used by both sides        |
| Data     | Prisma · PostgreSQL                                                   |

This is an npm **workspaces** monorepo:

```
backend/   NestJS app (realtime session, gateways, tools, Prisma)
frontend/  Next.js thin client (voice capture/playback, trace + approvals)
shared/    voice-agent-shared — Zod schemas + types (built to dist/)
specs/     Spec Kit feature spec, plan, research, data model
```

## Prerequisites

- Node.js LTS + npm
- PostgreSQL 16 (`brew install postgresql@16`)
- An OpenAI API key with Realtime access

## Setup

```bash
# 1. Install all workspaces (auto-builds shared/dist via its prepare script)
npm install

# 2. Start PostgreSQL and create the database
brew services start postgresql@16
createdb voice_agent

# 3. Configure backend env
cp .env.example backend/.env
#   then edit backend/.env:
#     OPENAI_API_KEY=sk-...
#     DATABASE_URL=postgresql://<user>@localhost:5432/voice_agent

# 4. Configure frontend env (optional — defaults to http://localhost:3000)
cp frontend/.env.example frontend/.env.local

# 5. Init schema + seed demo data (services, FAQs, sample bookings)
npm run db:migrate
npm run db:seed
```

## Running

```bash
# Backend (http://localhost:3000) — also rebuilds shared first
npm run backend:dev

# Frontend (http://localhost:3001) — in a second terminal
npm run frontend:dev
```

Open http://localhost:3001 and start talking to the agent.

> The root `npm run dev` starts both, but separate terminals give cleaner logs.

## Root scripts

| Script                     | What it does                                        |
| -------------------------- | --------------------------------------------------- |
| `npm run dev`              | Build shared, then run backend + frontend           |
| `npm run shared:build`     | Build `shared/dist` (Zod schemas + types)           |
| `npm run backend:dev`      | Build shared, then NestJS watch mode on `:3000`     |
| `npm run backend:build`    | Build shared, then `nest build`                     |
| `npm run frontend:dev`     | Next.js dev server on `:3001`                        |
| `npm run db:generate`      | `prisma generate`                                   |
| `npm run db:migrate`       | `prisma migrate dev`                                |
| `npm run db:seed`          | Seed demo services, FAQs, bookings                   |
| `npm run -w @voice-agent/backend test` | Backend unit + integration tests       |

## Environment variables

**`backend/.env`**

| Var               | Example                                          | Notes                          |
| ----------------- | ------------------------------------------------ | ------------------------------ |
| `OPENAI_API_KEY`  | `sk-...`                                          | Server-side only              |
| `DATABASE_URL`    | `postgresql://you@localhost:5432/voice_agent`    | PostgreSQL connection          |
| `DOMAIN_PRESET`   | `beauty-salon`                                    | Preset in `src/domain/presets/`|
| `MODEL_TIER`      | `dev` \| `live`                                   | dev = cheaper/faster model     |
| `PORT`            | `3000`                                            | Backend HTTP/Socket.IO port    |
| `BUSINESS_HOURS`  | `09:00-18:00`                                     | Drives availability            |
| `BUSINESS_DAYS`   | `Mon,Tue,Wed,Thu,Fri,Sat`                         |                                |
| `SLOT_STEP_MIN`   | `15`                                              | Availability slot granularity  |

**`frontend/.env.local`**

| Var                       | Example                  |
| ------------------------- | ------------------------ |
| `NEXT_PUBLIC_BACKEND_URL` | `http://localhost:3000`  |

## The `shared` package

`voice-agent-shared` holds the Zod schemas and types shared between backend and
frontend. Both consume its compiled output (`shared/dist`), which is **git-ignored**.
A `prepare` script builds `dist` automatically on `npm install`, so a fresh
checkout works out of the box.

If you edit files in `shared/src`, rebuild so consumers pick up the change:

```bash
npm run shared:build          # one-off
npm run dev -w voice-agent-shared   # watch mode while developing
```

Note: backend's `nest start --watch` does **not** rebuild shared on its own — run
the shared build (or use `npm run backend:dev`, which does it once at startup).

## Troubleshooting

- **`Cannot find module 'voice-agent-shared'`** — `shared/dist` isn't built. Run
  `npm install` (triggers `prepare`) or `npm run shared:build`.
- **`PrismaClientInitializationError ... URL must start with file:`** — the
  generated Prisma client is stale (built for a different provider). Run
  `npm run db:generate`.
- **`EADDRINUSE :::3000`** — a backend is already running. `pkill -f "nest start"`.
