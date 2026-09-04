# COGNOS — Cognitive Operators for Guidance, Navigation, Oversight, and Sovereignty

One Voice Outward. Many Minds Underneath.

A personal reasoning engine. Every message you send goes to a council of six
cognitive operators before anything is answered:

| Operator | Role |
| --- | --- |
| **Observer** | Sees what is actually there — intent, ambiguity, context |
| **Strategist** | Plans the approach — framing, paths, constraints |
| **Specialist** | Brings focused depth — the substantive work |
| **Synthesizer** | Merges the views into one answer |
| **Critic** | Attacks the weak points — scores the draft, demands revisions |
| **Governor** | Holds real veto power over the final answer |

The Sovereign principle sits above all of it: **the system would rather stay
silent than lie.** When the Governor withholds approval, the app refuses —
a no-answer beats a false one. Every request produces a visible council
trace beside the final answer.

Council charter: **Truth, Evidence, Agency, Dignity.**

## Stack

- Next.js 16 (App Router) + React 19 + TypeScript, mobile-first
- PostgreSQL (Neon) + Drizzle ORM — sessions, messages, long-term memories
- OpenAI-compatible chat completions at `https://api.bluesminds.com/v1/chat/completions`
- Deployable on the Vercel free tier; **no auth, no accounts, no login — ever**

## Environment variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `BLUESMINDS_API_KEY` | yes | API key for the council LLM calls |
| `BLUESMINDS_MODEL` | no | Model name. Default `gpt-4o-mini` (verified working) |
| `DATABASE_URL` | yes | PostgreSQL connection string (Neon **pooled** string on Vercel) |
| `COGNOS_RUNTIME_SECRET` | no | If set, every `/api` route requires a request header `x-cognos-secret` with the same value. Server-side only, no UI. Leave unset for normal use. |

## Local development

```bash
npm install

# 1. Create a database (Neon free tier, Supabase, or local Postgres)
# 2. Apply the schema — pick ONE:
npm run db:push          # simplest: push the Drizzle schema directly
# — or, for SQL migration files:
npm run db:generate      # emits SQL into ./drizzle
npm run db:migrate       # applies them in order (needs DATABASE_URL)

# 3. Configure the environment
cp .env.example .env     # fill in BLUESMINDS_API_KEY and DATABASE_URL

# 4. Run
npm run dev              # http://localhost:3000 — straight into chat
```

`npm run build` works without `DATABASE_URL` — the database is lazy-initialized
and only connected on the first real query.

## Deploy to Vercel

1. Push the repo and import it in Vercel (Next.js is auto-detected).
2. Create a Neon database and copy the **pooled** connection string
   (`Project → Connect → Connection string → Pooled`).
3. In Vercel → Settings → Environment Variables, add:
   - `DATABASE_URL` — the pooled string
   - `BLUESMINDS_API_KEY` — your key
   - `BLUESMINDS_MODEL` — optional, defaults to `gpt-4o-mini`
   - `COGNOS_RUNTIME_SECRET` — optional guard, see above
4. Apply the schema once against that database:
   - `npm run db:push` from a machine with `DATABASE_URL` exported, or
   - run the generated SQL (`npm run db:generate`, then the files in `drizzle/`)
     in the Neon SQL editor.
5. Deploy. The URL opens directly into a working chat. No accounts, no setup.

### Notes

- Use the **pooled** Neon string on Vercel; the direct string is for local
  `psql`/migrations.
- The first request after Neon's free instance has been paused can be slow
  once — the database is waking up; the pool recovers automatically.
- A council turn makes several LLM calls in one request; if a turn ever
  exceeds the Vercel function limit, raise the function duration in project
  settings.

## Architecture (one pass)

```
src/
├── app/
│   ├── page.tsx                     # chat (the only real page)
│   ├── memory/page.tsx              # view / manage long-term memories
│   └── api/
│       ├── health/route.ts          # DB + model status
│       ├── sessions/route.ts        # list / create conversations
│       ├── sessions/[id]/route.ts   # rename / delete conversation
│       ├── sessions/[id]/messages/route.ts   # load a conversation
│       ├── messages/route.ts        # THE COUNCIL TURN
│       └── memories/…               # view / add / toggle / delete memory
├── db/
│   ├── schema.ts                    # sessions, messages, memories (Drizzle)
│   └── index.ts                     # lazy pool — import never connects
├── lib/
│   ├── prompts.ts                   # identity, charter, styles, 6 operator prompts
│   ├── llm.ts                       # chat completion + tolerant JSON extraction
│   ├── council.ts                   # the deliberation pipeline + veto + memory
│   └── guard.ts                     # optional COGNOS_RUNTIME_SECRET check
├── components/                      # MessageBubble, CouncilTrace, …
└── types.ts
```

**The turn** (`POST /api/messages`):

1. Save the user message.
2. Load context: enabled memories (importance-ranked) + last 8 messages.
3. Run the council: Observer → Strategist → Specialist → Synthesizer →
   Critic (with a bounded revision loop) → Governor.
4. **Veto:** if the Governor declines approval, only its directive — or an
   explicit refusal — is released. The trace records the veto.
5. Persist memories (extraction pass + Governor recommendations, deduped).
6. Save the assistant message with its full council trace; refresh the
   session title/summary.

The trace is always stored and always visible in the UI (per-message
"council trace" toggle, one tab per operator).
