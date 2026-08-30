import { NextResponse } from "next/server";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";
import { SESSION_COOKIE, destroySession, getSessionFromCookies } from "@/lib/auth";
import { cookies } from "next/headers";

export async function POST() {
  try {
    const token = (await cookies()).get(SESSION_COOKIE)?.value;
    const user = await getSessionFromCookies();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // The administrator account is owned by server configuration, not by a
    // password. Never allow it to be deleted from the UI — and especially
    // not through the stateless auto sign-in mode.
    if (user.authMode === "admin-auto") {
      return NextResponse.json(
        {
          error:
            "Account deletion is disabled while administrator auto sign-in is active. Set ADMIN_AUTO_LOGIN=false and sign in normally first.",
        },
        { status: 403 }
      );
    }
    if (user.role === "admin") {
      return NextResponse.json(
        {
          error:
            "The administrator account is managed by server configuration and cannot be deleted from here.",
        },
        { status: 403 }
      );
    }

    // The user's workspaces cascade to sessions, messages, memories,
    // documents, insights, and audit events through the schema foreign keys.
    // Auth sessions also cascade off the user row.
    await db.delete(users).where(eq(users.id, user.id));

    if (token) {
      await destroySession(token).catch(() => {});
    }

    const response = NextResponse.json({ ok: true });
    response.cookies.set(SESSION_COOKIE, "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0),
    });
    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }
}
