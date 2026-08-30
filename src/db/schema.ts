import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

// ─── Enums ──────────────────────────────────────────────────────────────────

export const memoryTierEnum = pgEnum("memory_tier", [
  "short",
  "medium",
  "long",
  "mythic",
]);

export const operatorEnum = pgEnum("operator", [
  "observer",
  "strategist",
  "specialist",
  "synthesizer",
  "critic",
  "governor",
  "orchestrator",
]);

export const memoryTypeEnum = pgEnum("memory_type", [
  "working",
  "episodic",
  "semantic",
]);

export const evidenceEnum = pgEnum("evidence_level", [
  "direct",
  "repeated",
  "inferred",
  "assumed",
]);

export const volatilityEnum = pgEnum("volatility", [
  "low",
  "medium",
  "high",
]);

export const taskTypeEnum = pgEnum("task_type", [
  "conversation",
  "question_answering",
  "research",
  "planning",
  "coding",
  "analysis",
  "creative",
  "decision_support",
  "action_execution",
]);

export const statusEnum = pgEnum("status", [
  "pending",
  "processing",
  "complete",
  "success",
  "error",
]);

export const auditEventTypeEnum = pgEnum("audit_event_type", [
  "agent_invocation",
  "model_call",
  "memory_operation",
  "tool_call",
  "error",
]);

// ─── Workspaces ─────────────────────────────────────────────────────────────

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  description: text("description").default(""),
  instructions: text("instructions").default(""),
  color: text("color").notNull().default("#3B82F6"),
  icon: text("icon").notNull().default("Brain"),
  isDefault: boolean("is_default").notNull().default(false),
  memberEmails: jsonb("member_emails").$type<string[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Sessions (conversations) ────────────────────────────────────────────────

export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull().default("New Session"),
  summary: text("summary"),
  lastMessagePreview: text("last_message_preview").default(""),
  archived: boolean("archived").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Messages ────────────────────────────────────────────────────────────────

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant" | "system"
  content: text("content").notNull(),
  modelUsed: text("model_used"),
  taskType: taskTypeEnum("task_type"),
  attachments: jsonb("attachments").$type<
    Array<{ name: string; file_url: string; file_type: string }>
  >(),
  processingStatus: statusEnum("processing_status").notNull().default("complete"),
  councilTrace: jsonb("council_trace"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Memory ──────────────────────────────────────────────────────────────────

export const memories = pgTable("memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => sessions.id, {
    onDelete: "set null",
  }),
  tier: memoryTierEnum("tier").notNull().default("medium"),
  memoryType: memoryTypeEnum("memory_type").notNull().default("semantic"),
  operator: operatorEnum("operator").notNull().default("orchestrator"),
  key: text("key").notNull(),
  value: text("value").notNull(),
  importance: integer("importance").notNull().default(5),
  relevanceScore: integer("relevance_score").notNull().default(50),
  evidenceLevel: evidenceEnum("evidence_level").notNull().default("inferred"),
  volatility: volatilityEnum("volatility").notNull().default("medium"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  source: text("source"),
  lastConfirmed: timestamp("last_confirmed", { withTimezone: true }).defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

// ─── Insights (autonomous council deliberation) ──────────────────────────────

export const insights = pgTable("insights", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content").notNull(),
  triggerType: text("trigger_type").notNull().default("manual"),
  topic: text("topic").default(""),
  taskType: taskTypeEnum("task_type").default("analysis"),
  modelUsed: text("model_used"),
  council: jsonb("council").$type<Record<string, unknown>>(),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// ─── Activity / audit events ─────────────────────────────────────────────────

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  sessionId: uuid("session_id").references(() => sessions.id, {
    onDelete: "set null",
  }),
  description: text("description"),
  eventType: auditEventTypeEnum("event_type").notNull(),
  agentType: text("agent_type"),
  modelUsed: text("model_used"),
  taskType: taskTypeEnum("task_type"),
  tokenCount: integer("token_count").notNull().default(0),
  latencyMs: integer("latency_ms").notNull().default(0),
  status: statusEnum("status").notNull().default("success"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

// Helper for deriving the next update timestamp.
export function updateNow() {
  return sql`now()`;
}
