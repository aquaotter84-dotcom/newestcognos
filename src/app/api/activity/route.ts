import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { resolveWorkspaceId } from "@/lib/workspace";
import { requireAuth } from "@/lib/auth";

export async function GET(request: Request) {
  const auth = await requireAuth();
  if (!auth.user) return auth.response!;

  try {
    const { searchParams } = new URL(request.url);
    const workspace = await resolveWorkspaceId(searchParams.get("workspaceId"), auth.user.id);
    const all = await db
      .select()
      .from(auditEvents)
      .where(eq(auditEvents.workspaceId, workspace.id))
      .orderBy(desc(auditEvents.createdAt))
      .limit(200);
    return NextResponse.json(all);
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to fetch activity" }, { status: 500 });
  }
}
