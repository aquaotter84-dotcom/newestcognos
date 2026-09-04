import { NextResponse } from "next/server";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { eq } from "drizzle-orm";
import { runtimeGuard } from "@/lib/guard";
import type { Memory } from "@/types";

const TIERS = ["short", "medium", "long", "mythic"] as const;

function pick<T extends string>(value: unknown, valid: readonly T[], fallback: T): T {
  return valid.includes(value as T) ? (value as T) : fallback;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = runtimeGuard(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const body = (await request.json().catch(() => ({}))) as Partial<Memory>;

    const set: Record<string, unknown> = { updatedAt: new Date() };
    if (typeof body.isEnabled === "boolean") set.isEnabled = body.isEnabled;
    if (typeof body.value === "string" && body.value.trim()) {
      set.value = body.value.trim().slice(0, 2000);
    }
    if (body.tier !== undefined) set.tier = pick(body.tier, TIERS, "medium");
    if (typeof body.importance === "number") {
      set.importance = Math.max(1, Math.min(10, Math.round(body.importance)));
    }
    if (Object.keys(set).length === 1) {
      return NextResponse.json({ error: "nothing to update" }, { status: 400 });
    }

    const [updated] = await db
      .update(memories)
      .set(set)
      .where(eq(memories.id, id))
      .returning();
    if (!updated) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error("PATCH /api/memories/[id]:", err);
    return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
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
    const [deleted] = await db.delete(memories).where(eq(memories.id, id)).returning();
    if (!deleted) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("DELETE /api/memories/[id]:", err);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}
