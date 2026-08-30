# COGNOS — Base44 → open-source gap analysis

Reference repo: `aquaotter84-dotcom/cognitive-acuity` (Base44 export)
Target repo: `aquaotter84-dotcom/newestcognos` (this open-source Next.js rewrite)

## What the Base44 version had

The Base44 export is a Vite + React + Base44 SDK app with:

- **Multi-user auth** (Google, email + OTP, forgot/reset password) powered by Base44's platform.
- **Workspaces** — create/switch/edit, members, workspace-level instructions.
- **Chat** — conversations, attachments, camera/screen capture, voice conversation mode, auto-speak, web-search toggle, communication style selector, council trace, streaming, stop generation, summarization.
- **Threads** — library view with search, rename, delete, and branch.
- **Memory** — enriched fields (type episodic/semantic/working, importance, evidence_level, volatility, enabled), sharing between workspaces.
- **Documents** — upload files, VisionCapture (camera/screen), Google Drive imports, text extraction, and analysis.
- **Insights** — autonomous daily/scheduled/manual council deliberations.
- **Beliefs** — deterministic belief snapshots, evidence propagation, relationship graph.
- **Dynamics** — change events (evidence added/removed/reweighted, belief emerged/revised/collapsed).
- **Activity** — audit trail (agent invocations, model calls, memory operations, tools, errors).
- **System map** — 3D/architecture visual.
- **Agent app** — autonomous council runner.
- **Settings** — user stats, logout, account deletion.
- **Backend functions** — chatOrchestrate (context assembly, council, web search, memory extraction, audit, summarization), consolidateMemories, deriveBeliefs, runCouncilAutonomous, externalLLM, deleteAccount.

## What this open-source rewrite does now

This rewrite keeps the same product concept but avoids the Base44 SDK/runtime. It now has:

- Council chat with six operators (Observer, Strategist, Specialist, Synthesizer, Critic, Governor) + best-effort revision loop.
- Workspace-aware Postgres schema and CRUD.
- Threads (search / rename / delete / open).
- Enriched memory manager (tier, type, importance, evidence, volatility, enabled) with automatic extraction from turns.
- Autonomous insights runner + insights list.
- Activity audit trail.
- System map, beliefs view, dynamics timeline.
- Settings and workspaces pages.
- Docs placeholder for the document pipeline.

## Remaining gaps, in priority order

### High (most product impact)
1. **Auth / accounts** — the Base44 app logged users in. This build is single-tenant with a shared default workspace. Adding real auth (email/password or OAuth, sessions, per-user workspaces) is the biggest remaining gap.
2. **Document ingestion** — file upload, camera/screen capture, text extraction, and analysis. Needs a storage provider (Supabase, S3, Vercel Blob) plus a `documents` table and `vision` UI.
3. **Web search** — a real search tool in the Observer/council path (Base44 had a web-search toggle and results in the trace).

### Medium (feature parity)
4. **Voice** — speech-to-text input, conversation mode, and auto-speak on responses.
5. **Streaming + stop** — token-level streaming of the final response and an abort/stop control.
6. **Branching threads** — copy a conversation into a new branch.
7. **Attachments in chat** — upload files/images and feed extracted content into the council context.
8. **Memory sharing** — share a memory into another workspace (consent / revoke).
9. **Belief derivation** — deterministic belief snapshot propagation and relationship graph instead of the current derived view.
10. **Consolidation / scheduling** — nightly memory consolidation and scheduled daily briefings.
11. **Account deletion** — erase all records and sign out (already schemas exist, route not wired).

### Low (polish / self-host niceties)
12. **Mobile pull-to-refresh, safe-area, native PWA** polish.
13. **Better markdown rendering** (code syntax/render blocks rather than regex).
14. **Per-workspace model overrides** and model settings UI.
15. **Audit all memory/document/workspace mutations** as activity events.

## Decision needed

The biggest open question is **auth**: do you want this to remain a single-user / single-tenant tool, or should I build full multi-user accounts with per-user data isolation next? That decision determines how much of the remaining work is a strict port vs. a redesign.
