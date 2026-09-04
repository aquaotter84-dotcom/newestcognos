// Long-term memory: how memories are read into the council context and how
// new memories (extraction pass + Governor recommendations) are persisted.

import { db } from "@/db";
import { memories } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import type { MemoryExtraction } from "./council";

export type StoredMemory = typeof memories.$inferSelect;

const VALID_TIERS = ["short", "medium", "long", "mythic"] as const;
export type Tier = (typeof VALID_TIERS)[number];

export function slugifyKey(value: string): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  return slug || "memory";
}

/** Importance-ranked context block injected into every council turn. */
export async function buildMemoryContext(): Promise<string> {
  const active = await db
    .select()
    .from(memories)
    .where(eq(memories.isEnabled, true))
    .orderBy(desc(memories.importance), desc(memories.updatedAt))
    .limit(20);

  return active
    .slice(0, 12)
    .map((m) => `[${m.tier}/${m.key}]: ${m.value}`)
    .join("\n");
}

type NewMemory = {
  key: string;
  content: string;
  memory_type: MemoryExtraction["memory_type"];
  importance: number;
  evidence_level: MemoryExtraction["evidence_level"];
  volatility: MemoryExtraction["volatility"];
  tier: Tier;
};

/**
 * Persist new memories, deduped against what is already stored (there is no
 * unique constraint on key — the same fact must not re-insert every turn).
 */
export async function persistMemories(
  newMemories: NewMemory[],
  sourceSessionId: string
): Promise<number> {
  if (newMemories.length === 0) return 0;

  const existingKeys = new Set(
    (
      await db.select({ key: memories.key }).from(memories)
    ).map((m) => m.key)
  );

  const seen = new Set<string>();
  let inserted = 0;
  for (const mem of newMemories) {
    const key = slugifyKey(mem.key);
    if (seen.has(key) || existingKeys.has(key)) continue;
    seen.add(key);
    const tier: Tier = VALID_TIERS.includes(mem.tier) ? mem.tier : "medium";
    await db
      .insert(memories)
      .values({
        tier,
        memoryType: mem.memory_type,
        key,
        value: mem.content,
        importance: mem.importance,
        evidenceLevel: mem.evidence_level,
        volatility: mem.volatility,
        isEnabled: true,
        source: sourceSessionId,
      });
    inserted++;
  }
  return inserted;
}

/** Combine the Governor's recommendations with the extraction pass. */
export function collectMemoryCandidates(
  governorOutput: Record<string, unknown>,
  extracted: MemoryExtraction[]
): NewMemory[] {
  const recs = Array.isArray(governorOutput?.memoryRecommendation)
    ? (governorOutput.memoryRecommendation as Array<Record<string, unknown>>)
    : [];

  const governorMems: NewMemory[] = recs
    .filter((rec) => rec?.key && rec?.value)
    .slice(0, 3)
    .map((rec) => {
      const tier = VALID_TIERS.includes(rec.tier as Tier)
        ? (rec.tier as Tier)
        : "medium";
      return {
        key: String(rec.key),
        content: String(rec.value),
        memory_type: "semantic" as const,
        importance: 6,
        evidence_level: "inferred" as const,
        volatility: "medium" as const,
        tier,
      };
    });

  const extractedMems: NewMemory[] = extracted.slice(0, 5).map((m) => ({
    key: m.content.slice(0, 60),
    content: m.content,
    memory_type: m.memory_type,
    importance: m.importance,
    evidence_level: m.evidence_level,
    volatility: m.volatility,
    tier: m.tier,
  }));

  return [...governorMems, ...extractedMems];
}


