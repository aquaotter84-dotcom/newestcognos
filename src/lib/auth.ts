import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { db } from "@/db";
import { authSessions, users } from "@/db/schema";
import { eq } from "drizzle-orm";

export const SESSION_COOKIE = "cognos_session";
const SESSION_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

// ─── Administrator bootstrap (self-hosted single-operator mode) ────────────
//
// COGNOS is meant to run as a personal tool, so the deployer gets a
// deterministic way to be the administrator without manual SQL:
//
//   COGNOS_ADMIN_EMAIL / COGNOS_ADMIN_PASSWORD
//     - Logging in with these credentials always works, even on a fresh
//       database — the account is created on first use with role "admin".
//     - Registering with the same email also yields role "admin".
//
//   COGNOS_AUTO_SIGNIN=true (requires both vars above)
//     - The app signs the admin user in automatically on page load.
//       The login screen is never shown. See /api/auth/bootstrap.
export function getAdminConfig() {
  const email = (process.env.COGNOS_ADMIN_EMAIL || "").trim().toLowerCase();
  const password = process.env.COGNOS_ADMIN_PASSWORD || "";
  return {
    email: email || null,
    password: password || null,
    name: (process.env.COGNOS_ADMIN_NAME || "Administrator").trim() || "Administrator",
    autoSignin: process.env.COGNOS_AUTO_SIGNIN === "true",
  };
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string) {
  return bcrypt.compare(password, hash);
}

export function createToken() {
  return randomBytes(32).toString("hex");
}

export async function createSession(userId: string) {
  const token = createToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await db.insert(authSessions).values({
    token,
    userId,
    expiresAt,
  });
  return { token, expiresAt };
}

export async function destroySession(token: string) {
  await db.delete(authSessions).where(eq(authSessions.token, token));
}

export async function getUserBySessionToken(
  token: string
): Promise<AuthUser | null> {
  if (!token) return null;
  const rows = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      expiresAt: authSessions.expiresAt,
    })
    .from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .where(eq(authSessions.token, token))
    .limit(1);
  if (rows.length === 0) return null;
  const row = rows[0];
  if (new Date(row.expiresAt) < new Date()) {
    await destroySession(token);
    return null;
  }
  return { id: row.id, email: row.email, name: row.name, role: row.role };
}

export async function getSessionFromCookies() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return getUserBySessionToken(token);
}

export async function requireAuth() {
  const user = await getSessionFromCookies();
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as Response,
    };
  }
  return { user, response: null };
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  };
}

export function sessionCookieValue(token: string, expiresAt: Date) {
  const opts = sessionCookieOptions(expiresAt);
  const cookie = `${SESSION_COOKIE}=${token}; Path=${opts.path}; HttpOnly; SameSite=${opts.sameSite}; Expires=${opts.expires.toUTCString()}${
    opts.secure ? "; Secure" : ""
  }`;
  return cookie;
}

export function clearSessionCookie() {
  const expiresAt = new Date(0);
  return sessionCookieValue("", expiresAt);
}
