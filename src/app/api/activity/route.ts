import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditEvents } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { resolveWorkspaceId } from "@/lib/workspace";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const workspace = await resolveWorkspaceId(searchParams.get("workspaceId"));
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
