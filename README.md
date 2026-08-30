# COGNOS

Cognitive Operators for Guidance, Navigation, Oversight, and Sovereignty.

One Voice Outward. Many Minds Underneath.

A Next.js app (App Router, TypeScript, Tailwind 4, Drizzle ORM + PostgreSQL) that runs every message through a council of four operators — Observer, Strategist, Critic, Governor — plus an Orchestrator synthesis. The Governor recommends memories that are persisted in four tiers (short / medium / long / mythic). Council trace is available per message.

## Stack

- Next.js 16 (App Router) + React 19
- Drizzle ORM + node-postgres (PostgreSQL: Neon, Supabase, or any Postgres)
- BluesMinds API (OpenAI-compatible) for the council LLM calls

## Local development

1. Create a PostgreSQL database (e.g. free Neon or Supabase instance).
2. Run `src/db/schema.sql` in it once.
3. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — your Postgres connection string
   - `BLUESMINDS_API_KEY` — your BluesMinds key
   - optional: `BLUESMINDS_MODEL` (default `gpt_5_4`), `BLUESMINDS_API_URL` (default `https://api.bluesminds.com/v1/chat/completions`)
4. `npm install`
5. `npm run dev` — open http://localhost:3000

## Deploy on Vercel

1. Push this repo to GitHub.
2. Import it in Vercel (Framework preset: Next.js — auto-detected).
3. In Vercel project Settings → Environment Variables, add:
   - `DATABASE_URL`
   - `BLUESMINDS_API_KEY`
   - (optional) `BLUESMINDS_MODEL`
4. Deploy. The database tables must exist — run `src/db/schema.sql` in your database first.

## API

- `GET /api/health` — DB connectivity check
- `GET/POST/DELETE /api/memories` — memory panel CRUD
- `GET/POST /api/messages?sessionId=...` — session messages + council chat
- `GET/POST /api/sessions` — session list / create
- `PATCH/DELETE /api/sessions/[id]` — rename / delete session

## Notes

- Five LLM calls per message: Observer → Strategist → Critic → Governor → Orchestrator.
- The Governor's `memoryRecommendation` array is written to the `memories` table (max 3 per turn).
- This build does not use Base44 — no platform credits or meters involved.
