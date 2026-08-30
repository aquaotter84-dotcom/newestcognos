import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages, sessions, memories, auditEvents, workspaces, documents } from "@/db/schema";
import { eq, desc, asc, inArray } from "drizzle-orm";
import {
  runCouncil,
  extractMemories,
  summarizeConversation,
} from "@/lib/council";
import type { MemoryExtraction } from "@/lib/council";
import { requireAuth } from "@/lib/auth";
import { canAccessWorkspace } from "@/lib/workspace";
import { getDocumentContext } from "@/lib/documents";

export const maxDuration = 60;

const VALID_TIERS = ["short", "medium", "long", "mythic"] as const;
type Tier = (typeof VALID_TIERS)[number];

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
type TaskType = (typeof VALID_TASK_TYPES)[number];

function taskTypeFromValue(value: unknown): TaskType {
  const v = String(value || "conversation");
  return (VALID_TASK_TYPES as readonly string[]).includes(v)
    ? (v as TaskType)
    : "conversation";
}

function tierFromValue(value: unknown): Tier {
  const v = String(value || "medium");
  return (VALID_TIERS as readonly string[]).includes(v)
    ? (v as Tier)
    : "medium";
}

function slugifyKey(value: string) {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return slug || "memory";
}

function tierFromMemoryType(memoryType: string): Tier {
  if (memoryType === "working") return "short";
  if (memoryType === "episodic") return "medium";
  return "long";
}

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("sessionId");
  if (!sessionId) {
    return NextResponse.json({ error: "sessionId required" }, { status: 400 });
  }

  try {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, sessionId)).limit(1);
    if (!session || !(await canAccessWorkspace(session.workspaceId, auth.user.id))) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    const msgs = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt));
    return NextResponse.json(msgs);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  let start = Date.now();
  try {
    const body = await request.json();
    const { sessionId, content, showTrace, style, webSearch, attachments } = body;

    if (!sessionId || !content) {
      return NextResponse.json(
        { error: "sessionId and content required" },
        { status: 400 }
      );
    }

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    if (!session || !(await canAccessWorkspace(session.workspaceId, auth.user.id))) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const [workspace] = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, session.workspaceId))
      .limit(1);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    // Save user message
    const [userMsg] = await db
      .insert(messages)
      .values({
        sessionId,
        workspaceId: workspace.id,
        role: "user",
        content,
        processingStatus: "complete",
      })
      .returning();

    // Fetch conversation history
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt))
      .limit(30);

    const conversationHistory = history
      .filter((m) => m.id !== userMsg.id && m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    // Fetch relevant memories for this workspace
    const activeMemories = await db
      .select()
      .from(memories)
      .where(eq(memories.workspaceId, workspace.id))
      .orderBy(desc(memories.importance), desc(memories.updatedAt))
      .limit(20);

    const enabledMemories = activeMemories.filter((m) => m.isEnabled !== false);
    const memoryContext =
      enabledMemories.length > 0
        ? enabledMemories
            .slice(0, 12)
            .map((m) => `[${m.tier}/${m.key}]: ${m.value}`)
            .join("\n")
        : "";

    // Document context for the workspace (best-effort)
    const documentContext = await getDocumentContext(workspace.id);

    // Selected attachments for this specific turn
    const attachmentIds = Array.isArray(attachments)
      ? attachments.filter(Boolean).slice(0, 6)
      : [];
    const attachmentDocs = attachmentIds.length
      ? await db
          .select()
          .from(documents)
          .where(inArray(documents.id, attachmentIds))
          .limit(6)
      : [];
    const attachmentContext = attachmentDocs
      .filter((d) => d.contentText)
      .map((d) => `Attached document: ${d.name}\n${d.contentText?.slice(0, 5000) || ""}`)
      .join("\n\n");

    // Run the council
    const councilContext = [memoryContext, documentContext, attachmentContext]
      .filter(Boolean)
      .join("\n\n");

    const trace = await runCouncil(content, councilContext, conversationHistory, {
      style,
      webSearch: !!webSearch,
    });
    const latencyMs = Date.now() - start;

    // Save governor memory recommendations
    const govOutput = trace.governor as Record<string, unknown>;
    const memRecs = Array.isArray(govOutput?.memoryRecommendation)
      ? (govOutput.memoryRecommendation as Array<Record<string, unknown>>)
      : [];

    const extracted: MemoryExtraction[] = process.env.MEMORY_EXTRACTION !== "false"
      ? await extractMemories(content, trace.finalResponse)
      : [];

    const allMemories = [
      ...memRecs
        .filter((rec) => rec?.key && rec?.value)
        .slice(0, 3)
        .map((rec) => ({
          content: String(rec.value),
          memory_type: "semantic" as const,
          importance: 6,
          evidence_level: "inferred" as const,
          volatility: "medium" as const,
          tier: tierFromValue(rec.tier),
          key: slugifyKey(String(rec.key)),
        })),
      ...extracted.slice(0, 5).map((m) => ({
        content: m.content,
        memory_type: m.memory_type,
        importance: m.importance,
        evidence_level: m.evidence_level,
        volatility: m.volatility,
        tier: m.tier,
        key: slugifyKey(m.content.slice(0, 60)),
      })),
    ];

    for (const rec of allMemories) {
      const tier = tierFromValue(rec.tier);
      await db
        .insert(memories)
        .values({
          sessionId,
          workspaceId: workspace.id,
          tier,
          memoryType: rec.memory_type,
          operator: "governor",
          key: rec.key,
          value: rec.content,
          importance: rec.importance,
          evidenceLevel: rec.evidence_level,
          volatility: rec.volatility,
          relevanceScore: tier === "mythic" ? 90 : tier === "long" ? 75 : 60,
          isEnabled: true,
          source: sessionId,
          lastConfirmed: new Date(),
        })
        .onConflictDoNothing();
    }

    // Save assistant message
    const [assistantMsg] = await db
      .insert(messages)
      .values({
        sessionId,
        workspaceId: workspace.id,
        role: "assistant",
        content: trace.finalResponse,
        modelUsed: trace.latent.modelUsed,
        taskType: taskTypeFromValue(trace.latent.taskType),
        processingStatus: "complete",
        councilTrace: showTrace ? trace : null,
      })
      .returning();

    // Best-effort summary
    const summary = await summarizeConversation(
      conversationHistory.slice(-6),
      content,
      trace.finalResponse
    );

    // Update session title/preview/timestamp
    const sessionMsgs = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt))
      .limit(4);

    const firstUserMsg = sessionMsgs.find((m) => m.role === "user");
    const title =
      firstUserMsg && sessionMsgs.length <= 3
        ? firstUserMsg.content.slice(0, 60) +
          (firstUserMsg.content.length > 60 ? "…" : "")
        : undefined;

    await db
      .update(sessions)
      .set({
        title: title ?? undefined,
        summary: summary ?? undefined,
        lastMessagePreview: trace.finalResponse.slice(0, 120),
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    // Log activity
    await db
      .insert(auditEvents)
      .values({
        workspaceId: workspace.id,
        sessionId,
        description: `Council chat turn — ${trace.latent.taskType}`,
        eventType: "agent_invocation",
        agentType: "orchestrator",
        modelUsed: trace.latent.modelUsed,
        taskType: taskTypeFromValue(trace.latent.taskType),
        latencyMs,
        status: "success",
      })
      .onConflictDoNothing();

    return NextResponse.json({
      userMessage: userMsg,
      assistantMessage: assistantMsg,
      summary,
      trace: showTrace ? trace : null,
    });
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
