import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages, sessions } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import {
  extractMemories,
  runCouncil,
  summarizeConversation,
} from "@/lib/council";
import {
  buildMemoryContext,
  collectMemoryCandidates,
  persistMemories,
} from "@/lib/memory";
import { runtimeGuard } from "@/lib/guard";
import { STYLES, type Style } from "@/lib/prompts";

// A council turn is several sequential LLM calls; keep the Vercel function
// alive for the whole deliberation.
export const maxDuration = 60;

type MessageRow = typeof messages.$inferSelect;
type SessionRow = typeof sessions.$inferSelect;

function toMessageRow(row: MessageRow) {
  return {
    id: row.id,
    sessionId: row.sessionId,
    role: row.role,
    content: row.content,
    modelUsed: row.modelUsed,
    councilTrace: row.councilTrace,
    createdAt: row.createdAt,
  };
}

export async function POST(request: Request) {
  const denied = runtimeGuard(request);
  if (denied) return denied;

  const start = Date.now();
  let userMsg: MessageRow | null = null;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      sessionId?: string;
      content?: string;
      style?: string;
    };
    const { sessionId, content } = body;
    if (!sessionId || !content || !content.trim()) {
      return NextResponse.json(
        { error: "sessionId and content are required" },
        { status: 400 }
      );
    }
    const style: Style = STYLES.includes(body.style as Style)
      ? (body.style as Style)
      : "balanced";

    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);
    if (!session) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    // ── 1. Save the user message ───────────────────────────────────────────
    [userMsg] = await db
      .insert(messages)
      .values({
        sessionId,
        role: "user",
        content: content.trim(),
      })
      .returning();

    // ── 2. Context: memory + recent conversation ───────────────────────────
    const memoryContext = await buildMemoryContext().catch(() => "");
    const history = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt))
      .limit(30);
    const conversationHistory = history
      .filter((m) => m.id !== userMsg!.id)
      .map((m) => ({ role: m.role, content: m.content }));

    // ── 3. The council deliberates ─────────────────────────────────────────
    const trace = await runCouncil(
      content.trim(),
      memoryContext,
      conversationHistory,
      { style }
    );
    trace.latent.latencyMs = Date.now() - start;

    // ── 4. Save the assistant message — the trace is always stored, it is
    //     the soul of the product and is always visible in the UI. ─────────
    const [assistantMsg] = await db
      .insert(messages)
      .values({
        sessionId,
        role: "assistant",
        content: trace.finalResponse,
        modelUsed: trace.latent.modelUsed,
        councilTrace: trace,
      })
      .returning();

    // ── 5. Post-turn work (best effort, in parallel): memory extraction +
    //     rolling summary. Neither can fail the turn. ──────────────────────
    const [extracted, summary] = await Promise.all([
      extractMemories(content.trim(), trace.finalResponse),
      summarizeConversation(
        conversationHistory.slice(-6),
        content.trim(),
        trace.finalResponse
      ),
    ]);

    await persistMemories(
      collectMemoryCandidates(trace.governor, extracted),
      sessionId
    ).catch((err) => console.error("memory persistence failed:", err));

    // ── 6. Refresh the conversation (title on early turns, preview, summary)
    const recent = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, sessionId))
      .orderBy(asc(messages.createdAt))
      .limit(4);
    const firstUserMsg = recent.find((m) => m.role === "user");
    const title =
      firstUserMsg && recent.length <= 3
        ? firstUserMsg.content.slice(0, 60) +
          (firstUserMsg.content.length > 60 ? "…" : "")
        : undefined;

    await db
      .update(sessions)
      .set({
        ...(title ? { title } : {}),
        ...(summary ? { summary } : {}),
        lastMessagePreview: trace.finalResponse.slice(0, 120),
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    const sessionRow = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    return NextResponse.json({
      userMessage: toMessageRow(userMsg),
      assistantMessage: toMessageRow(assistantMsg),
      session: sessionRow[0] as SessionRow,
    });
  } catch (err) {
    // Roll back the saved user message so a failed deliberation does not
    // leave a dangling prompt in the conversation.
    if (userMsg) {
      await db
        .delete(messages)
        .where(eq(messages.id, userMsg.id))
        .catch(() => undefined);
    }
    const message = err instanceof Error ? err.message : "Council deliberation failed";
    console.error("POST /api/messages:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
