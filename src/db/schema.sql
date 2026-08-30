-- COGNOS schema (PostgreSQL)
-- Run this once in a fresh database (Neon/Supabase SQL editor, or `psql`).
-- For an existing COGNOS database, run src/db/migrate.sql instead.
-- Matches src/db/schema.ts (Drizzle).

-- ─── Enums ──────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE memory_tier AS ENUM ('short', 'medium', 'long', 'mythic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE operator AS ENUM ('observer', 'strategist', 'specialist', 'synthesizer', 'critic', 'governor', 'orchestrator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE memory_type AS ENUM ('working', 'episodic', 'semantic');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE evidence_level AS ENUM ('direct', 'repeated', 'inferred', 'assumed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE volatility AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE task_type AS ENUM ('conversation', 'question_answering', 'research', 'planning', 'coding', 'analysis', 'creative', 'decision_support', 'action_execution');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE status AS ENUM ('pending', 'processing', 'complete', 'success', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_event_type AS ENUM ('agent_invocation', 'model_call', 'memory_operation', 'tool_call', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── Workspaces ─────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS workspaces (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text DEFAULT '',
  instructions   text DEFAULT '',
  color          text NOT NULL DEFAULT '#3B82F6',
  icon           text NOT NULL DEFAULT 'Brain',
  is_default     boolean NOT NULL DEFAULT false,
  member_emails  jsonb DEFAULT '[]',
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

-- ─── Sessions (conversations) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sessions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title                text NOT NULL DEFAULT 'New Session',
  summary              text,
  last_message_preview text DEFAULT '',
  archived             boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ─── Messages ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS messages (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id        uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role              text NOT NULL,
  content           text NOT NULL,
  model_used        text,
  task_type         task_type,
  attachments       jsonb,
  processing_status status NOT NULL DEFAULT 'complete',
  council_trace     jsonb,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── Memory ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS memories (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id       uuid REFERENCES sessions(id) ON DELETE SET NULL,
  tier             memory_tier NOT NULL DEFAULT 'medium',
  memory_type      memory_type NOT NULL DEFAULT 'semantic',
  operator         operator NOT NULL DEFAULT 'orchestrator',
  key              text NOT NULL,
  value            text NOT NULL,
  importance       integer NOT NULL DEFAULT 5,
  relevance_score  integer NOT NULL DEFAULT 50,
  evidence_level   evidence_level NOT NULL DEFAULT 'inferred',
  volatility       volatility NOT NULL DEFAULT 'medium',
  is_enabled       boolean NOT NULL DEFAULT true,
  source           text,
  last_confirmed   timestamptz DEFAULT now(),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  expires_at       timestamptz
);

-- ─── Insights ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS insights (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  title        text NOT NULL,
  content      text NOT NULL,
  trigger_type text NOT NULL DEFAULT 'manual',
  topic        text DEFAULT '',
  task_type    task_type DEFAULT 'analysis',
  model_used   text,
  council      jsonb,
  is_read      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── Activity / audit events ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id   uuid REFERENCES sessions(id) ON DELETE SET NULL,
  description  text,
  event_type   audit_event_type NOT NULL,
  agent_type   text,
  model_used   text,
  task_type    task_type,
  token_count  integer NOT NULL DEFAULT 0,
  latency_ms   integer NOT NULL DEFAULT 0,
  status       status NOT NULL DEFAULT 'success',
  error_message text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- Indexes for common paths.
CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_workspace ON messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memories_workspace ON memories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_workspace ON insights(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);
