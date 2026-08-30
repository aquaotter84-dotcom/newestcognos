import { NextResponse } from "next/server";
import { db } from "@/db";
import { insights } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { resolveWorkspaceId, canAccessWorkspace } from "@/lib/workspace";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const { searchParams } = new URL(request.url);
    const workspace = await resolveWorkspaceId(searchParams.get("workspaceId"), auth.user.id);
    const all = await db
      .select()
      .from(insights)
      .where(eq(insights.workspaceId, workspace.id))
      .orderBy(desc(insights.createdAt))
      .limit(100);
    return NextResponse.json(all);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch insights" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const body = await request.json();
    const workspace = await resolveWorkspaceId(body.workspaceId, auth.user.id);
    const title = String(body.title || "").trim();
    const content = String(body.content || "").trim();
    if (!title || !content) {
      return NextResponse.json({ error: "title and content required" }, { status: 400 });
    }

    const [insight] = await db
      .insert(insights)
      .values({
        workspaceId: workspace.id,
        title,
        content,
        triggerType: body.triggerType ?? "manual",
        topic: body.topic ?? "",
        taskType: body.taskType ?? "analysis",
        modelUsed: body.modelUsed ?? null,
        council: body.council ?? null,
      })
      .returning();
    return NextResponse.json(insight, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create insight" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const body = await request.json();
    const id = body.id;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const [existing] = await db.select().from(insights).where(eq(insights.id, id)).limit(1);
    if (!existing || !(await canAccessWorkspace(existing.workspaceId, auth.user.id))) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    const [insight] = await db
      .update(insights)
      .set({
        title: body.title ?? undefined,
        content: body.content ?? undefined,
        isRead: body.isRead ?? undefined,
      })
      .where(eq(insights.id, id))
      .returning();
    if (!insight) return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    return NextResponse.json(insight);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update insight" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const [existing] = await db.select().from(insights).where(eq(insights.id, id)).limit(1);
    if (!existing || !(await canAccessWorkspace(existing.workspaceId, auth.user.id))) {
      return NextResponse.json({ error: "Insight not found" }, { status: 404 });
    }

    await db.delete(insights).where(eq(insights.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete insight" }, { status: 500 });
  }
}
