import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  SESSION_COOKIE,
  createSession,
  getAdminConfig,
  hashPassword,
  isValidEmail,
  sessionCookieOptions,
  verifyPassword,
} from "@/lib/auth";
import { ensureDefaultWorkspace } from "@/lib/workspace";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !isValidEmail(email) || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const admin = getAdminConfig();
    const isAdminEmail = !!admin.email && email === admin.email;
    // The configured admin password is a recovery credential: it always
    // works for the admin account — even on a fresh database, where the
    // account is created on first login.
    const adminPasswordOk =
      isAdminEmail && !!admin.password && password === admin.password;

    let rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
    let user = rows[0];

    if (!user && isAdminEmail && adminPasswordOk) {
      const [created] = await db
        .insert(users)
        .values({
          email,
          name: admin.name,
          passwordHash: await hashPassword(admin.password!),
          role: "admin",
        })
        .returning();
      user = created;
    }

    if (
      !user ||
      (!adminPasswordOk && !(await verifyPassword(password, user.passwordHash)))
    ) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // Keep the admin role in sync with the environment configuration.
    if (isAdminEmail && user.role !== "admin") {
      const [updated] = await db
        .update(users)
        .set({ role: "admin", updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
      user = updated;
    }

    const { token, expiresAt } = await createSession(user.id);
    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));

    // Best-effort: land the user in a ready-to-use workspace.
    await ensureDefaultWorkspace(user.id);

    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Login failed" }, { status: 500 });
  }
}
