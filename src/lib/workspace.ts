import { db } from "@/db";
import { users, workspaces } from "@/db/schema";
import { and, asc, desc, eq, sql } from "drizzle-orm";

export async function getOrCreateDefaultWorkspace(userId: string) {
  const owned = await db
    .select()
    .from(workspaces)
    .where(eq(workspaces.ownerId, userId))
    .orderBy(desc(workspaces.isDefault), asc(workspaces.createdAt))
    .limit(1);

  if (owned.length > 0) return owned[0];

  // Legacy default (created before accounts existed). It is claimed by the
  // FIRST account ever registered, then behaves like a normal owned
  // workspace. Until then it is visible to no one: all access checks below
  // require an ownerId match.
  const legacy = await db
    .select()
    .from(workspaces)
    .where(sql`${workspaces.ownerId} IS NULL`)
    .orderBy(desc(workspaces.isDefault), asc(workspaces.createdAt))
    .limit(1);
  if (legacy.length > 0) {
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(users);
    if (count === 1) {
      const [claimed] = await db
        .update(workspaces)
        .set({ ownerId: userId })
        .where(eq(workspaces.id, legacy[0].id))
        .returning();
      if (claimed) return claimed;
    }
    // More than one account exists: leave the legacy workspace unowned (it
    // is no longer readable by anyone) and fall through to a fresh personal
    // workspace. Claim it manually with:
    //   UPDATE workspaces SET owner_id = '<user id>' WHERE owner_id IS NULL;
  }

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

export async function canAccessWorkspace(workspaceId: string, userId: string) {
  const rows = await db
    .select()
    .from(workspaces)
    .where(and(eq(workspaces.id, workspaceId), eq(workspaces.ownerId, userId)))
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
        and(eq(workspaces.id, requested), eq(workspaces.ownerId, userId))
      )
      .limit(1);
    if (found.length > 0) return found[0];
  }
  return getOrCreateDefaultWorkspace(userId);
}
