# COGNOS — Base44 → open-source gap analysis (updated)

Reference repo: `aquaotter84-dotcom/cognitive-acuity` (Base44 export)
Target repo: `aquaotter84-dotcom/newestcognos` (open-source Next.js rewrite)

## Deployment target

- **Hosting:** Vercel (Next.js)
- **Database:** Neon Postgres (pooled connection string)
- Included in this branch: Neon/Vercel pool defaults, `vercel.json` cron (daily briefing at 08:00 UTC), `CRON_SECRET` support, and setup docs in `README.md`.

## Done in this branch

The open-source app now covers most of the Base44 product surface without the Base44 SDK:

- **Accounts** — email/password register, login, logout, hard delete; per-user data isolation.
- **Administrator mode** — `COGNOS_ADMIN_EMAIL`/`COGNOS_ADMIN_PASSWORD` provision an admin account from the environment (login works even on a fresh database; the env password doubles as a recovery credential). `COGNOS_AUTO_SIGNIN=true` bypasses the login screen entirely via `GET /api/auth/bootstrap`. Settings shows an admin badge and explains the mode.
- **First-run readiness** — the default workspace is created at register/login (and as a `GET /api/workspaces` fallback), and the chat input is enabled from the very first message (session is created lazily on send).
- **Workspaces** — CRUD, switching, per-workspace instructions, and per-user default creation.
- **Council chat** — Observer → Strategist → Specialist → Synthesizer → Critic (best-effort revision) → Governor → unified response.
- **Web search** — DuckDuckGo fallback plus Tavily/Exa provider support, with a chat toggle and trace display.
- **Documents** — file/URL/pasted-text ingestion, text + basic PDF extraction, summary/analysis, and attach-to-chat support.
- **Voice** — browser speech-to-text input and auto-speak output.
- **Streaming / stop** — client-side typewriter reveal plus an abort/stop control.
- **Threads** — search, rename, delete, branch.
- **Memory** — enriched fields, auto-extraction from turns, workspace sharing/revoke, activity logging.
- **Insights** — manual autonomous runs and scheduled daily briefings.
- **Activity** — audit trail.
- **Markdown** — real markdown rendering in chat bubbles.
- **Schema** — workspace-aware Postgres model with `src/db/schema.sql` (fresh) and `src/db/migrate.sql` (upgrade).

## Remaining gaps

### Medium / nice-to-have
1. **Web search reliability** — the DuckDuckGo HTML path is a best-effort fallback; a paid provider key is recommended for production.
2. **Deterministic belief derivation** — the Beliefs page is a derived view of enabled memories. Full deterministic evidence propagation and belief snapshots (Base44's `deriveBeliefs` / `BeliefSnapshot`) are not implemented.
3. **Memory consolidation** — a nightly consolidation pass that collapses duplicate/overlapping memory entries is not implemented (the daily briefing exists).
4. **Full vision / screen / camera ingestion** — image documents are stored but marked as needing a vision transcript; true multimodal analysis is not wired.
5. **Conversation mode** — continuous conversation-mode UI around speech (Base44's phone-style overlay) is not implemented; single-turn speech input is.
6. **OAuth / Google sign-in** — only email/password is available.
7. **Email delivery** — forgot-password form exists but does not send email.

### Low / polish
8. **Per-workspace model overrides** and a model settings UI.
9. **PWA / mobile safe-area / pull-to-refresh polish.**
10. **Audit coverage for document deletes/updates** (currently chat and memory mutations are logged).

## Decisions still open

- Do you want **full multimodal document analysis** (images via vision) or is text/PDF enough for now?
- Do you want **OAuth/Google** accounts, or is email/password sufficient?
- Do you want a **nightly consolidation job** scheduled via Vercel cron / GitHub Actions, or is the manual daily briefing sufficient?
