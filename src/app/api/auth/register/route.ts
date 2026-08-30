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
} from "@/lib/auth";
import { ensureDefaultWorkspace } from "@/lib/workspace";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const email = String(body.email || "").trim().toLowerCase();
    const name = String(body.name || "").trim();
    const password = String(body.password || "");

    if (!email || !isValidEmail(email)) {
      return NextResponse.json({ error: "A valid email is required" }, { status: 400 });
    }
    if (!name) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }
    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existing = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(password);
    const admin = getAdminConfig();
    const role = admin.email && email === admin.email ? "admin" : undefined;
    const [user] = await db
      .insert(users)
      .values(role ? { email, name, passwordHash, role } : { email, name, passwordHash })
      .returning();

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
    return NextResponse.json({ error: "Registration failed" }, { status: 500 });
  }
}
