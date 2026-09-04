import { NextResponse } from "next/server";
import { db } from "@/db";
import { memories } from "@/db/schema";
import { desc } from "drizzle-orm";
import { runtimeGuard } from "@/lib/guard";
import type { Memory } from "@/types";

const TIERS = ["short", "medium", "long", "mythic"] as const;
const TYPES = ["working", "episodic", "semantic"] as const;
const EVIDENCE = ["direct", "repeated", "inferred", "assumed"] as const;
const VOLATILITY = ["low", "medium", "high"] as const;

function pick<T extends string>(value: unknown, valid: readonly T[], fallback: T): T {
  return valid.includes(value as T) ? (value as T) : fallback;
}

export async function GET(request: Request) {
  const denied = runtimeGuard(request);
  if (denied) return denied;
  try {
    const list = await db
      .select()
      .from(memories)
      .orderBy(desc(memories.importance), desc(memories.updatedAt))
      .limit(200);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/memories:", err);
    return NextResponse.json({ error: "Failed to load memories" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = runtimeGuard(request);
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => ({}))) as Partial<
      Omit<Memory, "id" | "createdAt" | "updatedAt" | "source">
    > & { key?: string; value?: string };

    const key = String(body.key || "").trim().slice(0, 120);
    const value = String(body.value || "").trim().slice(0, 2000);
    if (!key || !value) {
      return NextResponse.json({ error: "key and value are required" }, { status: 400 });
    }

    const [mem] = await db
      .insert(memories)
      .values({
        key,
        value,
        tier: pick(body.tier, TIERS, "medium"),
        memoryType: pick(body.memoryType, TYPES, "semantic"),
        evidenceLevel: pick(body.evidenceLevel, EVIDENCE, "direct"),
        volatility: pick(body.volatility, VOLATILITY, "medium"),
        importance: Math.max(1, Math.min(10, Number(body.importance || 5))),
        isEnabled: true,
      })
      .returning();

    return NextResponse.json(mem, { status: 201 });
  } catch (err) {
    console.error("POST /api/memories:", err);
    return NextResponse.json({ error: "Failed to save memory" }, { status: 500 });
  }
}
