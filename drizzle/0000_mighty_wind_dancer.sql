CREATE TYPE "public"."evidence_level" AS ENUM('direct', 'repeated', 'inferred', 'assumed');--> statement-breakpoint
CREATE TYPE "public"."memory_tier" AS ENUM('short', 'medium', 'long', 'mythic');--> statement-breakpoint
CREATE TYPE "public"."memory_type" AS ENUM('working', 'episodic', 'semantic');--> statement-breakpoint
CREATE TYPE "public"."volatility" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tier" "memory_tier" DEFAULT 'medium' NOT NULL,
	"memory_type" "memory_type" DEFAULT 'semantic' NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"importance" integer DEFAULT 5 NOT NULL,
	"evidence_level" "evidence_level" DEFAULT 'inferred' NOT NULL,
	"volatility" "volatility" DEFAULT 'medium' NOT NULL,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"source" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" text NOT NULL,
	"content" text NOT NULL,
	"model_used" text,
	"council_trace" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text DEFAULT 'New conversation' NOT NULL,
	"summary" text,
	"last_message_preview" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_memories_importance_updated" ON "memories" USING btree ("importance","updated_at");--> statement-breakpoint
CREATE INDEX "idx_messages_session_created" ON "messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_sessions_updated_at" ON "sessions" USING btree ("updated_at");