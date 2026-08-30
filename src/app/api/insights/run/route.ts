import { NextResponse } from "next/server";
import { db } from "@/db";
import { workspaces, memories, messages, sessions, auditEvents, insights } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { runCouncil } from "@/lib/council";
import { resolveWorkspaceId } from "@/lib/workspace";

const VALID_TASK_TYPES = [
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

function taskTypeFromValue(value: unknown): (typeof VALID_TASK_TYPES)[number] {
  const v = String(value || "analysis");
  return (VALID_TASK_TYPES as readonly string[]).includes(v)
    ? (v as (typeof VALID_TASK_TYPES)[number])
    : "analysis";
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const workspace = await resolveWorkspaceId(body.workspaceId);
    const topic = String(body.topic || "").trim();
    if (!topic) {
      return NextResponse.json({ error: "topic required" }, { status: 400 });
    }

    const start = Date.now();

    const ws = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, workspace.id))
      .limit(1);

    const recentSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.workspaceId, workspace.id))
      .orderBy(desc(sessions.updatedAt))
      .limit(8);

    const allMessages = recentSessions.length
      ? await db
          .select()
          .from(messages)
          .where(eq(messages.workspaceId, workspace.id))
          .orderBy(desc(messages.createdAt))
          .limit(40)
      : [];

    const priorConversation = allMessages
      .slice()
      .reverse()
      .slice(-10)
      .filter((m) => m.content)
      .map((m) => ({ role: m.role, content: m.content }));

    const memoriesForWorkspace = await db
      .select()
      .from(memories)
      .where(eq(memories.workspaceId, workspace.id))
      .orderBy(desc(memories.importance), desc(memories.updatedAt))
      .limit(20);

    const memoryContext = memoriesForWorkspace
      .filter((m) => m.isEnabled !== false)
      .map((m) => `[${m.tier}/${m.key}]: ${m.value}`)
      .join("\n");

    const context = [
      `Workspace: ${ws[0]?.name || "Unknown"}`,
      memoryContext ? `Memory context:\n${memoryContext}` : "",
      priorConversation.length
        ? `Recent activity:\n${priorConversation
            .map((m) => `${m.role === "user" ? "User" : "COGNOS"}: ${m.content}`)
            .join("\n")}`
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const trace = await runCouncil(
      `Autonomous deliberation — ${topic}\n\n${context}`,
      memoryContext,
      priorConversation,
      { style: body.style || "balanced" }
    );

    const latencyMs = Date.now() - start;
    const title = topic
      .split("\n")
      .map((l) => l.trim())
      .find(Boolean)
      ?.slice(0, 100) || "Autonomous insight";

    const [insight] = await db
      .insert(insights)
      .values({
        workspaceId: workspace.id,
        title,
        content: trace.finalResponse,
        triggerType: "manual",
        topic,
        taskType: taskTypeFromValue(trace.latent.taskType),
        modelUsed: trace.latent.modelUsed,
        council: trace,
      })
      .returning();

    await db
      .insert(auditEvents)
      .values({
        workspaceId: workspace.id,
        description: `Autonomous deliberation — ${topic.slice(0, 80)}`,
        eventType: "agent_invocation",
        agentType: "autonomous",
        modelUsed: trace.latent.modelUsed,
        taskType: taskTypeFromValue(trace.latent.taskType),
        latencyMs,
        status: "success",
      })
      .onConflictDoNothing();

    return NextResponse.json({ insight, trace });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
