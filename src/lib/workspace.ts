import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { asc, desc, eq } from "drizzle-orm";

export async function getOrCreateDefaultWorkspace() {
  const existing = await db
    .select()
    .from(workspaces)
    .orderBy(desc(workspaces.isDefault), asc(workspaces.createdAt))
    .limit(1);

  if (existing.length > 0) return existing[0];

  // Small race guard: if two processes try at once, one insert wins and the
  // other can read it immediately after the conflict.
  try {
    const [created] = await db
      .insert(workspaces)
      .values({
        name: "Personal",
        description: "Your default workspace",
        isDefault: true,
      })
      .onConflictDoNothing({ target: workspaces.id })
      .returning();
    if (created) return created;
  } catch {
    // fall through to re-read
  }

  const again = await db
    .select()
    .from(workspaces)
    .orderBy(desc(workspaces.isDefault), asc(workspaces.createdAt))
    .limit(1);
  if (again.length > 0) return again[0];

  throw new Error("Unable to create or find a default workspace");
}

export async function resolveWorkspaceId(requested?: string | null) {
  if (requested) {
    const found = await db
      .select()
      .from(workspaces)
      .where(eq(workspaces.id, requested))
      .limit(1);
    if (found.length > 0) return found[0];
  }
  return getOrCreateDefaultWorkspace();
}
