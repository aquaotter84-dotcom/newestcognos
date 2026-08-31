# COGNOS

Cognitive Operators for Guidance, Navigation, Oversight, and Sovereignty.

One Voice Outward. Many Minds Underneath.

A self-hostable Next.js app (App Router, TypeScript, Tailwind 4, Drizzle ORM + PostgreSQL) that runs chat, memory, autonomous deliberations, and an architecture monitor through a council of cognitive operators: Observer, Strategist, Specialist, Synthesizer, Critic, and Governor.

This is the open-source rewrite of the Base44 “COGNOS / Cognitive-Acuity” app. It uses no Base44 SDK, credits, or meters.

## What it does

- **Chat** — every message runs through the six-operator council and returns one unified response. Council traces are visible per message.
- **Memory** — the council recommends durable memories (short / medium / long / mythic), with an enriched data model (`memory_type`, `importance`, `evidence_level`, `volatility`, `is_enabled`).
- **Threads** — search, rename, open, and delete conversations per workspace.
- **Workspaces** — create, edit, switch, and delete separate cognitive contexts.
- **Accounts** — email/password registration, login, logout, hard delete. Data is scoped to the signed-in user and their workspaces. Administrator mode (env-configured admin + optional auto sign-in that bypasses the login screen) for self-hosted single-operator deployments.
- **Insights** — autonomous one-off deliberations stored as insights, plus scheduled daily briefings for cron.
- **Activity** — audit trail of council invocations, model calls, and memory operations.
- **System** — visual architecture map of the pipeline.
- **Beliefs / Dynamics** — derived view of enabled memory and a timeline of changes.
- **Documents** — add files, URLs, or pasted text; text/PDF extraction, LLM summary, and attachment to the council context.
- **Voice** — speech-to-text input and an "auto-speak" output toggle.
- **Streaming / stop** — typewriter reveal of the response and a stop control while the council is running.
- **Branching threads** — copy a conversation into a new session.
- **Memory sharing** — share a memory with another workspace and revoke the share.

## Stack

- Next.js 16 (App Router) + React 19
- Drizzle ORM + node-postgres (PostgreSQL: Neon, Supabase, or any Postgres)
- BluesMinds API (OpenAI-compatible) or any OpenAI-compatible chat endpoint for the council LLM calls

## Local development

1. Create a PostgreSQL database (free Neon or Supabase instance).
2. For a **fresh** database, run `src/db/schema.sql` in it once.
   For an **existing** COGNOS database, run `src/db/migrate.sql` to upgrade to the workspace-aware schema.
3. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — your Postgres connection string
   - `BLUESMINDS_API_KEY` — your BluesMinds key
   - optional: `BLUESMINDS_MODEL` (default `gpt_5_4`), `BLUESMINDS_API_URL` (default `https://api.bluesminds.com/v1/chat/completions`)
   - optional: `MEMORY_EXTRACTION=true|false` (memory extraction is on by default)
   - optional: `COUNCIL_MAX_REVISIONS` (default `1`), `COUNCIL_REVISION_THRESHOLD` (default `70`)
   - optional web search: `WEB_SEARCH_PROVIDER=duckduckgo|tavily|exa` plus applicable API key (`TAVILY_API_KEY` / `EXA_API_KEY`)
   - optional administrator access: `ADMIN_BYPASS_KEY` (key sign-in from `/login`) and/or `ADMIN_AUTO_LOGIN=true` (skip the login screen; private deployments only) — see "Administrator access" below
4. `npm install`
5. `npm run dev` — open http://localhost:3000

## Deploy on Neon + Vercel

1. Create a Neon database (free plan is fine) and copy the **pooled** connection string (`Project → Connect → Connection string → Pooled`). It looks like `postgresql://...-pooler...ssl=require`.
2. Run `src/db/schema.sql` in the Neon SQL editor once (or `src/db/migrate.sql` if you already used the older single-workspace schema).
3. Push this repo to GitHub and import it in Vercel (framework preset: Next.js — auto-detected).
4. Add these Vercel Environment Variables:
   - `DATABASE_URL` — the Neon pooled string
   - `BLUESMINDS_API_KEY` — your BluesMinds key
   - `CRON_SECRET` — a strong random string (e.g. `openssl rand -hex 32`)
   - optional `BLUESMINDS_MODEL`, `MEMORY_EXTRACTION`, `COUNCIL_MAX_REVISIONS`
   - optional `WEB_SEARCH_PROVIDER` + provider key for Tavily/Exa
   - optional administrator mode: `COGNOS_ADMIN_EMAIL`, `COGNOS_ADMIN_PASSWORD`, and `COGNOS_AUTO_SIGNIN=true` to bypass the login screen (see below)
5. In Vercel project Settings → Cron Jobs, enable the built-in cron (the repo already includes `vercel.json` with a daily briefing at 08:00 UTC) and set the secret to the same `CRON_SECRET`.
6. Deploy. Sign in (or use administrator mode below), then use the app.

### Administrator mode (skip the login screen)

COGNOS is built for self-hosted single-operator use, so you can become the
administrator from environment variables alone — no manual SQL:

- `COGNOS_ADMIN_EMAIL` + `COGNOS_ADMIN_PASSWORD`
  - **Login with these credentials always works**, even on a completely fresh
    database: the account is created on first use with role `admin`. The
    configured password doubles as a recovery credential for that account.
  - Registering with `COGNOS_ADMIN_EMAIL` also yields role `admin`.
- `COGNOS_AUTO_SIGNIN=true` (requires both variables above)
  - **The login screen is bypassed entirely.** On every page load the app
    asks `/api/auth/bootstrap` to mint a session for the admin user, so you
    open the app and you're in, as `◆ Administrator` (see Settings).
  - Add the same variable in Vercel Environment Variables for production.

If you don't set these, the app behaves normally: register at `/register`,
sign in at `/login`, role `user`.

### Troubleshooting (Vercel + Neon)

- `/api/health` returns `{"ok":false}` → check `DATABASE_URL` exists in the
  Vercel environment (use the **pooled** string) and that `src/db/schema.sql`
  was actually run in the Neon SQL editor. A 500 that says
  `relation "users" does not exist` means the schema was never applied.
- Login says **"Invalid email or password"** → there is simply no account
  with that email yet. Register one, or use administrator mode above (the
  admin login works even on an empty database).
- First request after the free Neon instance has been paused for a while can
  be slow or fail once — the DB is waking up. Retry; the connection pool
  recovers automatically.
- The daily cron briefing runs the full council per workspace and can exceed
  the function time limit on small Vercel plans. If briefings error, raise
  the plan's function duration or keep the number of workspaces small.

### Neon notes
- Use the **pooled** connection string in Vercel; the direct (non-pooler) string is best for local `psql`/migrations.
- `src/db/index.ts` caps the pool at `DATABASE_POOL_MAX` (default 10) and reuses the pool across warm serverless invocations; set it lower if you hit Neon connection limits.

## Administrator access

COGNOS has no privileged sign-in path by default. Two **opt-in, environment-gated** mechanisms exist for the instance administrator:

1. **Bypass key** — set `ADMIN_BYPASS_KEY` to a strong random value (e.g. `openssl rand -hex 32`). The `/login` page then shows an "Administrator access" panel. Enter the key to be signed in as the administrator. The exchange happens server-side (`POST /api/auth/admin-login`), the key is compared in constant time, and the resulting session is a normal, revocable session cookie recorded in the audit trail.
2. **Auto sign-in** — set `ADMIN_AUTO_LOGIN=true` to skip the login screen entirely: any request without a session cookie is treated as the administrator. Use **only** for private, single-user deployments behind your own access control (localhost, VPN, home network). While this mode is on, the administrator account cannot be deleted and the Sign out button has no lasting effect.

Both mechanisms resolve to a dedicated DB-backed administrator user (`role = "admin"`, unguessable random password hash) so all existing guards — workspace ownership, session expiry, logout, audit — keep working. The administrator account is owned by server configuration and cannot be deleted from the UI.

## API

- `GET /api/health` — DB connectivity, active model, and administrator-access status
- `GET/POST /api/auth/admin-login` — administrator-access status / key sign-in (requires `ADMIN_BYPASS_KEY`)
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/delete-account` — account management
- `GET /api/auth/bootstrap` — admin auto sign-in (only active with `COGNOS_AUTO_SIGNIN=true`)
- `GET/POST/PATCH/DELETE /api/workspaces` — workspace CRUD
- `GET/POST/PATCH /api/sessions?workspaceId=...` — session list / create / update
- `PATCH/DELETE /api/sessions/[id]` — session update / delete
- `POST /api/sessions/[id]/branch` — copy a thread into a new session
- `GET/POST /api/messages?sessionId=...` — session messages + council chat (supports `webSearch` and document `attachments`)
- `GET/POST/PATCH/DELETE /api/memories` — memory CRUD, per-workspace sharing, DELETE via `?id=`
- `GET/POST/PATCH/DELETE /api/documents` — document CRUD + text/URL/PDF ingestion
- `GET/POST/PATCH/DELETE /api/insights` — insights CRUD
- `POST /api/insights/run` — run one autonomous deliberation
- `POST /api/insights/briefing` — run scheduled daily briefings (usable from cron)
- `GET /api/activity` — activity / audit trail

## Notes

- The council performs these stages per turn: Observer → Strategist → Specialist → Synthesizer → Critic (with best-effort revision loop) → Governor → Orchestrator response.
- The Governor's `memoryRecommendation` array and a separate memory-extraction pass are written to the `memories` table.
- Conversation summaries are written back to the session so threads retain continuity.
- This build does not use Base44 — no platform credits or meters involved.
