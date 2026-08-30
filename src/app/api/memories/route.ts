import { NextResponse } from "next/server";
import { db } from "@/db";
import { memories, auditEvents } from "@/db/schema";
import { eq, desc, or, sql } from "drizzle-orm";
import { resolveWorkspaceId, canAccessWorkspace } from "@/lib/workspace";
import { requireAuth } from "@/lib/auth";

const VALID_TIERS = ["short", "medium", "long", "mythic"];
const VALID_TYPES = ["working", "episodic", "semantic"];
const VALID_EVIDENCE = ["direct", "repeated", "inferred", "assumed"];
const VALID_VOLATILITY = ["low", "medium", "high"];

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const { searchParams } = new URL(request.url);
    const workspace = await resolveWorkspaceId(searchParams.get("workspaceId"), auth.user.id);

    const all = await db
      .select()
      .from(memories)
      .where(
        or(
          eq(memories.workspaceId, workspace.id),
          sql`${memories.sharedWorkspaceIds} @> ${JSON.stringify([workspace.id])}::jsonb`
        )
      )
      .orderBy(desc(memories.importance), desc(memories.updatedAt))
      .limit(200);

    return NextResponse.json(all);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch memories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const body = await request.json();
    const workspace = await resolveWorkspaceId(body.workspaceId, auth.user.id);

    const key = String(body.key || "").trim();
    const value = String(body.value || "").trim();
    if (!key || !value) {
      return NextResponse.json({ error: "key and value required" }, { status: 400 });
    }

    const [mem] = await db
      .insert(memories)
      .values({
        workspaceId: workspace.id,
        sessionId: body.sessionId ?? undefined,
        tier: VALID_TIERS.includes(body.tier) ? body.tier : "medium",
        memoryType: VALID_TYPES.includes(body.memoryType) ? body.memoryType : "semantic",
        operator: body.operator ?? "orchestrator",
        key,
        value,
        importance: Math.max(1, Math.min(10, Number(body.importance ?? 5))),
        relevanceScore: Math.max(0, Math.min(100, Number(body.relevanceScore ?? 50))),
        evidenceLevel: VALID_EVIDENCE.includes(body.evidenceLevel)
          ? body.evidenceLevel
          : "inferred",
        volatility: VALID_VOLATILITY.includes(body.volatility)
          ? body.volatility
          : "medium",
        isEnabled: body.isEnabled !== false,
        source: body.source ?? undefined,
        lastConfirmed: new Date(),
      })
      .returning();

    await db
      .insert(auditEvents)
      .values({
        workspaceId: workspace.id,
        sessionId: mem.sessionId ?? undefined,
        description: `Memory created: ${key}`,
        eventType: "memory_operation",
        agentType: mem.operator || "orchestrator",
        status: "success",
      })
      .onConflictDoNothing();

    return NextResponse.json(mem, { status: 201 });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to create memory" }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const body = await request.json();
    const id = body.id;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const [existing] = await db.select().from(memories).where(eq(memories.id, id)).limit(1);
    if (!existing || !(await canAccessWorkspace(existing.workspaceId, auth.user.id))) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    const [mem] = await db
      .update(memories)
      .set({
        key: body.key ?? undefined,
        value: body.value ?? undefined,
        tier: VALID_TIERS.includes(body.tier) ? body.tier : undefined,
        memoryType: VALID_TYPES.includes(body.memoryType)
          ? body.memoryType
          : undefined,
        importance:
          body.importance !== undefined
            ? Math.max(1, Math.min(10, Number(body.importance)))
            : undefined,
        relevanceScore:
          body.relevanceScore !== undefined
            ? Math.max(0, Math.min(100, Number(body.relevanceScore)))
            : undefined,
        evidenceLevel: VALID_EVIDENCE.includes(body.evidenceLevel)
          ? body.evidenceLevel
          : undefined,
        volatility: VALID_VOLATILITY.includes(body.volatility)
          ? body.volatility
          : undefined,
        isEnabled: body.isEnabled !== undefined ? body.isEnabled : undefined,
        sharedWorkspaceIds: Array.isArray(body.sharedWorkspaceIds)
          ? body.sharedWorkspaceIds
          : undefined,
        updatedAt: new Date(),
      })
      .where(eq(memories.id, id))
      .returning();

    if (!mem) return NextResponse.json({ error: "Memory not found" }, { status: 404 });

    await db
      .insert(auditEvents)
      .values({
        workspaceId: mem.workspaceId,
        sessionId: mem.sessionId ?? undefined,
        description: `Memory updated: ${mem.key}`,
        eventType: "memory_operation",
        agentType: "orchestrator",
        status: "success",
      })
      .onConflictDoNothing();

    return NextResponse.json(mem);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const [existing] = await db
      .select()
      .from(memories)
      .where(eq(memories.id, id))
      .limit(1);
    if (!existing || !(await canAccessWorkspace(existing.workspaceId, auth.user.id))) {
      return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    }

    await db.delete(memories).where(eq(memories.id, id));

    if (existing) {
      await db
        .insert(auditEvents)
        .values({
          workspaceId: existing.workspaceId,
          sessionId: existing.sessionId ?? undefined,
          description: `Memory deleted: ${existing.key}`,
          eventType: "memory_operation",
          agentType: "orchestrator",
          status: "success",
        })
        .onConflictDoNothing();
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}
