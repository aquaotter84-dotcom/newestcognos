import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions, messages } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { canAccessWorkspace } from "@/lib/workspace";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const { id } = await params;
    const [source] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);

    if (!source || !(await canAccessWorkspace(source.workspaceId, auth.user.id))) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const [branch] = await db
      .insert(sessions)
      .values({
        workspaceId: source.workspaceId,
        title: `${source.title} (branch)`,
        summary: source.summary,
        lastMessagePreview: source.lastMessagePreview,
        archived: false,
      })
      .returning();

    const sourceMessages = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, id))
      .orderBy(asc(messages.createdAt));

    if (sourceMessages.length > 0) {
      await db.insert(messages).values(
        sourceMessages.map((m) => ({
          sessionId: branch.id,
          workspaceId: m.workspaceId,
          role: m.role,
          content: m.content,
          modelUsed: m.modelUsed,
          taskType: m.taskType,
          attachments: m.attachments,
          processingStatus: m.processingStatus,
          councilTrace: m.councilTrace,
        }))
      );
    }

    return NextResponse.json(branch, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to branch session" }, { status: 500 });
  }
}
