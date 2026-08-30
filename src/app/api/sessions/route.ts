import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import { canAccessWorkspace, resolveWorkspaceId } from "@/lib/workspace";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const { searchParams } = new URL(request.url);
    const workspace = await resolveWorkspaceId(
      searchParams.get("workspaceId"),
      auth.user.id
    );

    const allSessions = await db
      .select()
      .from(sessions)
      .where(eq(sessions.workspaceId, workspace.id))
      .orderBy(desc(sessions.updatedAt))
      .limit(100);

    return NextResponse.json(allSessions);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch sessions" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const body = await request.json().catch(() => ({}));
    const workspace = await resolveWorkspaceId(body.workspaceId, auth.user.id);
    const title = body.title ?? "New Session";

    const [session] = await db
      .insert(sessions)
      .values({
        title,
        workspaceId: workspace.id,
        lastMessagePreview: body.lastMessagePreview ?? "",
      })
      .returning();

    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create session" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const body = await request.json().catch(() => ({}));
    const id = body.id;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
    }
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
