import { NextResponse } from "next/server";
import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { asc, eq } from "drizzle-orm";

export async function GET() {
  try {
    const all = await db.select().from(workspaces).orderBy(asc(workspaces.name));
    return NextResponse.json(all);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch workspaces" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body.name || "").trim();
    if (!name) {
      return NextResponse.json({ error: "Workspace name is required" }, { status: 400 });
    }

    const existing = await db.select().from(workspaces).limit(1);
    if (existing.length === 0) {
      const [ws] = await db
        .insert(workspaces)
        .values({
          name,
          description: String(body.description || ""),
          instructions: String(body.instructions || ""),
          color: String(body.color || "#3B82F6"),
          icon: String(body.icon || "Brain"),
          isDefault: true,
          memberEmails: Array.isArray(body.memberEmails)
            ? body.memberEmails
            : [],
        })
        .returning();
      return NextResponse.json(ws, { status: 201 });
    }

    const [ws] = await db
      .insert(workspaces)
      .values({
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
  try {
    const body = await request.json().catch(() => ({}));
    const id = body.id;
    if (!id) {
      return NextResponse.json({ error: "id required" }, { status: 400 });
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
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    const all = await db.select().from(workspaces).limit(2);
    if (all.length <= 1) {
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
