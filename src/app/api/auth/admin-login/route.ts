import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import {
  SESSION_COOKIE,
  createSession,
  sessionCookieOptions,
} from "@/lib/auth";
import {
  getOrCreateAdminUser,
  isAdminAutoLoginEnabled,
  isAdminBypassConfigured,
  verifyAdminKey,
} from "@/lib/admin";
import { getOrCreateDefaultWorkspace } from "@/lib/workspace";

/**
 * GET — tells the /login page whether administrator access is configured
 * (used to decide whether to render the "Administrator access" panel).
 */
export async function GET() {
  return NextResponse.json({
    configured: isAdminBypassConfigured(),
    autoLogin: isAdminAutoLoginEnabled(),
  });
}

/**
 * POST — exchange ADMIN_BYPASS_KEY for a regular, revocable session cookie.
 * Requires ADMIN_BYPASS_KEY to be set (>= 16 chars); otherwise 404.
 */
export async function POST(request: Request) {
  if (!isAdminBypassConfigured()) {
    return NextResponse.json(
      { error: "Administrator access is not configured on this instance" },
      { status: 404 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const adminKey = String(body.adminKey || "");
  if (!adminKey || !verifyAdminKey(adminKey)) {
    return NextResponse.json({ error: "Invalid administrator key" }, { status: 401 });
  }

  try {
    const user = await getOrCreateAdminUser();
    const { token, expiresAt } = await createSession(user.id);

    // Sovereignty bookkeeping: record the privileged sign-in in the audit
    // trail (best-effort — never block the sign-in on logging).
    try {
      const workspace = await getOrCreateDefaultWorkspace(user.id);
      await db
        .insert(auditEvents)
        .values({
          workspaceId: workspace.id,
          description: "Administrator signed in via bypass key",
          eventType: "tool_call",
          agentType: "governor",
          status: "success",
        })
        .onConflictDoNothing();
    } catch (err) {
      console.error("Failed to audit administrator sign-in:", err);
    }

    const response = NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return response;
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Administrator sign-in failed" },
      { status: 500 }
    );
  }
}
