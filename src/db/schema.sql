-- COGNOS schema (PostgreSQL)
-- Run this once in your database (Neon/Supabase SQL editor, or `psql`).
-- Matches src/db/schema.ts (Drizzle).

CREATE TABLE IF NOT EXISTS sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title      text NOT NULL DEFAULT 'New Session',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS messages (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  role          text NOT NULL,
  content       text NOT NULL,
  council_trace jsonb,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS messages_session_idx ON messages(session_id, created_at);

CREATE TABLE IF NOT EXISTS memories (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      uuid REFERENCES sessions(id) ON DELETE SET NULL,
  tier            text NOT NULL DEFAULT 'medium' CHECK (tier IN ('short','medium','long','mythic')),
  operator        text NOT NULL DEFAULT 'orchestrator' CHECK (operator IN ('observer','strategist','critic','governor','orchestrator')),
  key             text NOT NULL,
  value           text NOT NULL,
  relevance_score integer NOT NULL DEFAULT 50,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz
);

CREATE INDEX IF NOT EXISTS memories_relevance_idx ON memories(relevance_score DESC, updated_at DESC);
