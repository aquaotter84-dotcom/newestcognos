import { NextResponse } from "next/server";
import { db } from "@/db";
import {
  workspaces,
  memories,
  messages,
  sessions,
  insights,
  auditEvents,
} from "@/db/schema";
import { desc, eq, or, isNull } from "drizzle-orm";
import { runCouncil } from "@/lib/council";
import { requireAuth } from "@/lib/auth";

const DEFAULT_TOPIC = "Daily Council Briefing. Review recent activity and stored memory, then give one focused review of the day.";

export const maxDuration = 60;

function taskTypeFromValue(value: unknown) {
  const types = [
    "conversation",
    "question_answering",
    "research",
    "planning",
    "coding",
    "analysis",
    "creative",
    "decision_support",
    "action_execution",
  ] as const;
  const v = String(value || "analysis");
  return (types as readonly string[]).includes(v)
    ? (v as (typeof types)[number])
    : "analysis";
}

async function runForWorkspace(workspaceId: string) {
  const start = Date.now();
  const recentSessions = await db
    .select()
    .from(sessions)
    .where(eq(sessions.workspaceId, workspaceId))
    .orderBy(desc(sessions.updatedAt))
    .limit(8);

  const allMessages = recentSessions.length
    ? await db
        .select()
        .from(messages)
        .where(eq(messages.workspaceId, workspaceId))
        .orderBy(desc(messages.createdAt))
        .limit(40)
    : [];

  const priorConversation = allMessages
    .slice()
    .reverse()
    .slice(-10)
    .filter((m) => m.content)
    .map((m) => ({ role: m.role, content: m.content }));

  const memoryRows = await db
    .select()
    .from(memories)
    .where(eq(memories.workspaceId, workspaceId))
    .orderBy(desc(memories.importance), desc(memories.updatedAt))
    .limit(20);

  const memoryContext = memoryRows
    .filter((m) => m.isEnabled !== false)
    .map((m) => `[${m.tier}/${m.key}]: ${m.value}`)
    .join("\n");

  const context = [
    priorConversation.length
      ? `Recent activity:\n${priorConversation
          .map((m) => `${m.role === "user" ? "User" : "COGNOS"}: ${m.content}`)
          .join("\n")}`
      : "",
    memoryContext ? `Memory context:\n${memoryContext}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  const trace = await runCouncil(
    `${DEFAULT_TOPIC}\n\n${context}`,
    memoryContext,
    priorConversation,
    { style: "balanced" }
  );

  const latencyMs = Date.now() - start;
  const title = trace.finalResponse
    .split("\n")
    .map((l) => l.trim())
    .find(Boolean)
    ?.replace(/^#+\s*/, "")
    .slice(0, 100) || "Daily briefing";

  const [insight] = await db
    .insert(insights)
    .values({
      workspaceId,
      title,
      content: trace.finalResponse,
      triggerType: "scheduled",
      topic: "daily_briefing",
      taskType: taskTypeFromValue(trace.latent.taskType),
      modelUsed: trace.latent.modelUsed,
      council: trace,
    })
    .returning();

  await db
    .insert(auditEvents)
    .values({
      workspaceId,
      description: `Scheduled daily briefing — ${title}`,
      eventType: "agent_invocation",
      agentType: "autonomous",
      modelUsed: trace.latent.modelUsed,
      taskType: taskTypeFromValue(trace.latent.taskType),
      latencyMs,
      status: "success",
    })
    .onConflictDoNothing();

  return { workspaceId, insightId: insight.id, title };
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const requested = body.workspaceId ? String(body.workspaceId) : null;

  // Vercel Cron sends the CRON_SECRET as a Bearer token in Authorization.
  // When that is configured, the scheduled briefing runs without a user
  // session across the app's workspaces.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  const isCron = Boolean(cronSecret) && authHeader === `Bearer ${cronSecret}`;

  let userId: string | null = null;
  if (!isCron) {
    const auth = await requireAuth();
    if (!auth.user) return auth.response!;
    userId = auth.user.id;
  }

  try {
    let targets;
    if (requested) {
      targets = await db
        .select()
        .from(workspaces)
        .where(eq(workspaces.id, requested))
        .limit(1);
      if (
        targets.length === 0 ||
        (!isCron && targets[0].ownerId !== userId)
      ) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
      }
    } else if (isCron) {
      targets = await db.select().from(workspaces);
    } else {
      targets = await db
        .select()
        .from(workspaces)
        .where(or(eq(workspaces.ownerId, userId!), isNull(workspaces.ownerId)));
    }

    const processed = [];
    const errors = [];
    for (const ws of targets) {
      try {
        processed.push(await runForWorkspace(ws.id));
      } catch (err) {
        errors.push({
          workspaceId: ws.id,
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return NextResponse.json({ processed, errors });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
