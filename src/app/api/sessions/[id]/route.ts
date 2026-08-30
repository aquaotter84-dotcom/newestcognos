import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { canAccessWorkspace } from "@/lib/workspace";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const [existing] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    if (!existing || !(await canAccessWorkspace(existing.workspaceId, auth.user.id))) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const [updated] = await db
      .update(sessions)
      .set({
        title: body.title ?? undefined,
        summary: body.summary ?? undefined,
        lastMessagePreview: body.lastMessagePreview ?? undefined,
        archived: body.archived ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(sessions.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const { id } = await params;
    const [existing] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    if (!existing || !(await canAccessWorkspace(existing.workspaceId, auth.user.id))) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    await db.delete(sessions).where(eq(sessions.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete session" }, { status: 500 });
  }
}
