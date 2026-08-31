import { createHash, randomBytes, timingSafeEqual } from "crypto";
import bcrypt from "bcryptjs";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import type { AuthUser } from "@/lib/auth";

/**
 * Administrator access (Governor-grade, opt-in only).
 *
 * COGNOS has no privileged sign-in path by default. Two explicit,
 * environment-gated mechanisms are provided for the instance administrator:
 *
 * 1. ADMIN_BYPASS_KEY — a shared secret the administrator types on the
 *    /login page ("Administrator access" panel). Exchanges the key for a
 *    regular, revocable session cookie via POST /api/auth/admin-login.
 *    The key never leaves the server, is never stored client-side, and is
 *    compared in constant time.
 *
 * 2. ADMIN_AUTO_LOGIN=true — skip the login screen entirely: any request
 *    without a session cookie is treated as the administrator. Intended
 *    ONLY for private, single-user deployments behind the operator's own
 *    access control (home network, VPN, localhost). Turned off by default.
 *
 * Both mechanisms resolve to a dedicated, DB-backed administrator user
 * (role = "admin", unguessable random password hash) so every downstream
 * guard (workspace ownership, session expiry, logout, audit events) keeps
 * working without weakening the rest of the architecture.
 */

export const ADMIN_EMAIL = "admin@cognos.local";
export const ADMIN_NAME = "Administrator";

export function isAdminBypassConfigured(): boolean {
  const key = process.env.ADMIN_BYPASS_KEY;
  return Boolean(key && key.trim().length >= 16);
}

export function isAdminAutoLoginEnabled(): boolean {
  return process.env.ADMIN_AUTO_LOGIN === "true";
}

/** Constant-time comparison (both sides hashed to equal length first). */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function verifyAdminKey(key: string): boolean {
  const expected = process.env.ADMIN_BYPASS_KEY;
  if (!isAdminBypassConfigured() || !expected || !key) return false;
  return safeEqual(expected, key);
}

/**
 * Returns the single administrator user, creating it on first use.
 * The password hash is a random 256-bit value, so the administrator
 * account can never be signed into with a password.
 */
export async function getOrCreateAdminUser(): Promise<AuthUser> {
  const existing = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    const user = existing[0];
    // Keep the role canonical if someone registered this address first.
    if (user.role !== "admin") {
      await db
        .update(users)
        .set({ role: "admin", updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }
    return {
      id: user.id,
      email: user.email,
      name: user.name || ADMIN_NAME,
      role: "admin",
      authMode: "session",
    };
  }

  const passwordHash = await bcrypt.hash(randomBytes(32).toString("hex"), 12);
  const [created] = await db
    .insert(users)
    .values({
      email: ADMIN_EMAIL,
      name: ADMIN_NAME,
      role: "admin",
      passwordHash,
    })
    .onConflictDoNothing({ target: users.email })
    .returning();

  if (created) {
    return {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      authMode: "session",
    };
  }

  // Lost a creation race — pick up the row the other caller inserted.
  const [again] = await db
    .select()
    .from(users)
    .where(eq(users.email, ADMIN_EMAIL))
    .limit(1);
  if (!again) {
    throw new Error("Unable to create the administrator account");
  }
  return {
    id: again.id,
    email: again.email,
    name: again.name,
    role: "admin",
    authMode: "session",
  };
}

/**
 * Auto sign-in: when ADMIN_AUTO_LOGIN is enabled, unauthenticated requests
 * resolve to the administrator user. Returns null when the mode is off.
 */
export async function getAdminAutoLoginUser(): Promise<AuthUser | null> {
  if (!isAdminAutoLoginEnabled()) return null;
  try {
    const admin = await getOrCreateAdminUser();
    return { ...admin, authMode: "admin-auto" };
  } catch (err) {
    console.error("Admin auto sign-in failed:", err);
    return null;
  }
}
