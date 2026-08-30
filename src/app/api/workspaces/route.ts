import { NextResponse } from "next/server";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { and, asc, eq, or, isNull } from "drizzle-orm";
import { requireAuth } from "@/lib/auth";
import {
  canAccessWorkspace,
  getOrCreateDefaultWorkspace,
} from "@/lib/workspace";

export async function GET() {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    // A fresh account has no workspaces yet — make sure the default one
    // exists so the sidebar and chat are usable on first load.
    await getOrCreateDefaultWorkspace(auth.user.id);

    const all = await db
      .select()
      .from(workspaces)
      .where(or(eq(workspaces.ownerId, auth.user.id), isNull(workspaces.ownerId)))
      .orderBy(asc(workspaces.name));
    return NextResponse.json(all);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch workspaces" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    const [ws] = await db
      .insert(workspaces)
      .values({
        ownerId: auth.user.id,
        name,
        description: String(body.description || ""),
        instructions: String(body.instructions || ""),
        color: String(body.color || "#3B82F6"),
        icon: String(body.icon || "Brain"),
        isDefault: false,
        memberEmails: Array.isArray(body.memberEmails)
          ? body.memberEmails
          : [],
      })
      .returning();
    return NextResponse.json(ws, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
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
    if (!(await canAccessWorkspace(id, auth.user.id))) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    const [updated] = await db
      .update(workspaces)
      .set({
        name: body.name ?? undefined,
        description: body.description ?? undefined,
        instructions: body.instructions ?? undefined,
        color: body.color ?? undefined,
        icon: body.icon ?? undefined,
        isDefault: body.isDefault ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(workspaces.id, id))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update workspace" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    if (!(await canAccessWorkspace(id, auth.user.id))) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const accessible = await db
      .select()
      .from(workspaces)
      .where(
        and(
          or(eq(workspaces.ownerId, auth.user.id), isNull(workspaces.ownerId)),
          eq(workspaces.id, id)
        )
      )
      .limit(1);
    const remaining = await db
      .select()
      .from(workspaces)
      .where(or(eq(workspaces.ownerId, auth.user.id), isNull(workspaces.ownerId)))
      .limit(2);

    if (accessible.length > 0 && remaining.length <= 1) {
      return NextResponse.json(
        { error: "Cannot delete the last workspace" },
        { status: 400 }
      );
    }

    await db.delete(workspaces).where(eq(workspaces.id, id));
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete workspace" }, { status: 500 });
  }
}
