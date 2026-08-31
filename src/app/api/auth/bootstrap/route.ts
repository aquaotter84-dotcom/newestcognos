import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import {
  SESSION_COOKIE,
  createSession,
  getAdminConfig,
  getSessionFromCookies,
  hashPassword,
  sessionCookieOptions,
} from "@/lib/auth";

// Admin auto sign-in (login-screen bypass) for self-hosted deployments.
//
// Enabled only when COGNOS_AUTO_SIGNIN=true AND COGNOS_ADMIN_EMAIL /
// COGNOS_ADMIN_PASSWORD are configured. The endpoint is idempotent:
//   - already signed in  -> returns the current user
//   - fresh browser      -> provisions the admin account (if needed) and
//                           mints a session cookie, so the app opens
//                           directly into the dashboard as the administrator.
export async function GET() {
  const admin = getAdminConfig();
  if (!admin.autoSignin) {
    return NextResponse.json(
      { error: "Auto sign-in is not enabled on this deployment" },
      { status: 404 }
    );
  }
  if (!admin.email || !admin.password) {
    return NextResponse.json(
      {
        error:
          "Auto sign-in is enabled but COGNOS_ADMIN_EMAIL / COGNOS_ADMIN_PASSWORD are missing",
      },
      { status: 500 }
    );
  }

  try {
    const existing = await getSessionFromCookies();
    if (existing) {
      return NextResponse.json({ ...existing, autoSignin: true });
    }

    let rows = await db
      .select()
      .from(users)
      .where(eq(users.email, admin.email))
      .limit(1);
    let user = rows[0];

    if (!user) {
      [user] = await db
        .insert(users)
        .values({
          email: admin.email,
          name: admin.name,
          passwordHash: await hashPassword(admin.password),
          role: "admin",
        })
        .returning();
    } else if (user.role !== "admin") {
      [user] = await db
        .update(users)
        .set({ role: "admin", updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
    }

    const { token, expiresAt } = await createSession(user.id);
    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      autoSignin: true,
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return response;
  } catch (err) {
    console.error("Auto sign-in failed", err);
    return NextResponse.json({ error: "Auto sign-in failed" }, { status: 500 });
  }
}
