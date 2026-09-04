import {
  boolean,
  index,
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

export const volatilityEnum = pgEnum("volatility", ["low", "medium", "high"]);

// ─── Conversations ──────────────────────────────────────────────────────────

export const sessions = pgTable(
  "sessions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    title: text("title").notNull().default("New conversation"),
    summary: text("summary"),
    lastMessagePreview: text("last_message_preview").notNull().default(""),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_sessions_updated_at").on(table.updatedAt),
  ]
);

// ─── Messages ───────────────────────────────────────────────────────────────

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  sessionId: uuid("session_id")
    .notNull()
    .references(() => sessions.id, { onDelete: "cascade" }),
  role: text("role").notNull(), // "user" | "assistant"
  content: text("content").notNull(),
  modelUsed: text("model_used"),
  /** The full council trace for assistant messages — what each operator
   *  contributed, the latent stats, and whether the Governor vetoed. */
  councilTrace: jsonb("council_trace"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_messages_session_created").on(table.sessionId, table.createdAt),
]);

// ─── Long-term memory ───────────────────────────────────────────────────────

export const memories = pgTable("memories", {
  id: uuid("id").primaryKey().defaultRandom(),
  tier: memoryTierEnum("tier").notNull().default("medium"),
  memoryType: memoryTypeEnum("memory_type").notNull().default("semantic"),
  key: text("key").notNull(),
  value: text("value").notNull(),
  importance: integer("importance").notNull().default(5),
  evidenceLevel: evidenceEnum("evidence_level").notNull().default("inferred"),
  volatility: volatilityEnum("volatility").notNull().default("medium"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  source: text("source"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_memories_importance_updated").on(table.importance, table.updatedAt),
]);
