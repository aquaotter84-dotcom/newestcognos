import { db } from "@/db";
import { workspaces } from "@/db/schema";
import { and, asc, desc, eq, or, isNull } from "drizzle-orm";

export async function getOrCreateDefaultWorkspace(userId: string) {
  const owned = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .orderBy(desc(workspaces.isDefault), asc(workspaces.createdAt))
    .limit(1);

  if (owned.length > 0) return owned[0];

  // Legacy default (created before accounts existed) is shared by everyone
  // until an owned workspace exists.
  const legacy = await db
    .select()
    .from(workspaces)
    .where(isNull(workspaces.ownerId))
    .orderBy(desc(workspaces.isDefault), asc(workspaces.createdAt))
    .limit(1);
  if (legacy.length > 0) return legacy[0];

  const [created] = await db
    .insert(workspaces)
    .values({
      ownerId: userId,
      name: "Personal",
      description: "Your default workspace",
      isDefault: true,
    })
    .onConflictDoNothing({ target: workspaces.id })
    .returning();
  if (created) return created;

  const again = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .orderBy(desc(workspaces.isDefault), asc(workspaces.createdAt))
    .limit(1);
  if (again.length > 0) return again[0];

  throw new Error("Unable to create or find a default workspace");
}

// Best-effort variant used right after register/login so the first screen
// the user sees already has a workspace (and an enabled chat input).
export async function ensureDefaultWorkspace(userId: string) {
  try {
    return await getOrCreateDefaultWorkspace(userId);
  } catch (err) {
    console.error("Failed to ensure default workspace", err);
    return null;
  }
}

export async function canAccessWorkspace(workspaceId: string, userId: string) {
  const rows = await db
    .select()
    .from(workspaces)
    .where(
      and(
        eq(workspaces.id, workspaceId),
        or(eq(workspaces.ownerId, userId), isNull(workspaces.ownerId))
      )
    )
    .limit(1);
  return rows.length > 0;
}

export async function resolveWorkspaceId(
  requested: string | null | undefined,
  userId: string
) {
  if (requested) {
    const found = await db
      .select()
      .from(workspaces)
      .where(
        and(
          eq(workspaces.id, requested),
          or(eq(workspaces.ownerId, userId), isNull(workspaces.ownerId))
        )
      )
      .limit(1);
    if (found.length > 0) return found[0];
  }
  return getOrCreateDefaultWorkspace(userId);
}
