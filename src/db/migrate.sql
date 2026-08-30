-- COGNOS upgrade migration (from the original single-workspace schema to the
-- workspace-aware data model).
-- Run this once in an existing COGNOS database. Safe to run repeatedly.
-- A fresh database should use src/db/schema.sql instead.

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
  ALTER TYPE status ADD VALUE IF NOT EXISTS 'success';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE audit_event_type AS ENUM ('agent_invocation', 'model_call', 'memory_operation', 'tool_call', 'error');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email         text NOT NULL UNIQUE,
  name          text NOT NULL DEFAULT '',
  password_hash text NOT NULL,
  role          text NOT NULL DEFAULT 'user',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token      text NOT NULL UNIQUE,
  user_id    uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_auth_sessions_token ON auth_sessions(token);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);

CREATE TABLE IF NOT EXISTS workspaces (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id       uuid REFERENCES users(id) ON DELETE CASCADE,
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
ALTER TABLE workspaces ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES users(id) ON DELETE CASCADE;

-- Backfill a default workspace for any pre-workspace rows.
INSERT INTO workspaces (name, description, is_default)
SELECT 'Personal', 'Your default workspace', true
WHERE NOT EXISTS (SELECT 1 FROM workspaces);

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS summary text;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS last_message_preview text DEFAULT '';
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;

ALTER TABLE messages ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS model_used text;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS task_type task_type;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments jsonb;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS processing_status status NOT NULL DEFAULT 'complete';

ALTER TABLE memories ADD COLUMN IF NOT EXISTS workspace_id uuid REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS memory_type memory_type NOT NULL DEFAULT 'semantic';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS importance integer NOT NULL DEFAULT 5;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS evidence_level evidence_level NOT NULL DEFAULT 'inferred';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS volatility volatility NOT NULL DEFAULT 'medium';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS is_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE memories ADD COLUMN IF NOT EXISTS shared_workspace_ids jsonb DEFAULT '[]';
ALTER TABLE memories ADD COLUMN IF NOT EXISTS last_confirmed timestamptz DEFAULT now();

-- Attach any legacy rows to the default workspace.
UPDATE sessions SET workspace_id = (SELECT id FROM workspaces ORDER BY is_default DESC, created_at ASC LIMIT 1)
WHERE workspace_id IS NULL;
UPDATE messages SET workspace_id = COALESCE((SELECT s.workspace_id FROM sessions s WHERE s.id = messages.session_id),
                                           (SELECT id FROM workspaces ORDER BY is_default DESC, created_at ASC LIMIT 1))
WHERE workspace_id IS NULL;
UPDATE memories SET workspace_id = COALESCE((SELECT s.workspace_id FROM sessions s WHERE s.id = memories.session_id),
                                            (SELECT id FROM workspaces ORDER BY is_default DESC, created_at ASC LIMIT 1))
WHERE workspace_id IS NULL;

-- Now that they are populated, enforce NOT NULL.
ALTER TABLE sessions ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE messages ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE memories ALTER COLUMN workspace_id SET NOT NULL;

CREATE TABLE IF NOT EXISTS documents (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  session_id        uuid REFERENCES sessions(id) ON DELETE SET NULL,
  name              text NOT NULL,
  source            text NOT NULL DEFAULT 'upload',
  file_url          text,
  file_type         text,
  mime_type         text,
  category          text NOT NULL DEFAULT 'document',
  content_text      text,
  summary           text,
  analysis          text,
  processing_status status NOT NULL DEFAULT 'pending',
  error_message     text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_documents_workspace ON documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents(created_at DESC);

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

CREATE INDEX IF NOT EXISTS idx_sessions_workspace ON sessions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_workspace ON messages(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memories_workspace ON memories(workspace_id);
CREATE INDEX IF NOT EXISTS idx_memories_importance ON memories(importance DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_insights_workspace ON insights(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_workspace ON audit_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at DESC);
