import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runtimeGuard } from "@/lib/guard";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = runtimeGuard(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as { title?: string };
    const title =
      typeof body.title === "string" ? body.title.trim().slice(0, 120) : undefined;
    if (!title) {
      return NextResponse.json({ error: "title required" }, { status: 400 });
    }

    const [updated] = await db
      .update(sessions)
      .set({ title, updatedAt: new Date() })
      .where(eq(sessions.id, id))
      .returning();

    if (!updated) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/sessions/[id]:", err);
    return NextResponse.json({ error: "Failed to update conversation" }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = runtimeGuard(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const [deleted] = await db.delete(sessions).where(eq(sessions.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/sessions/[id]:", err);
    return NextResponse.json({ error: "Failed to delete conversation" }, { status: 500 });
  }
}
