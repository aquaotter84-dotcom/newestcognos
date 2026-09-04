import { NextResponse } from "next/server";
import { db } from "@/db";
import { messages, sessions } from "@/db/schema";
import { asc, eq } from "drizzle-orm";
import { runtimeGuard } from "@/lib/guard";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = runtimeGuard(request);
  if (denied) return denied;
  try {
    const { id } = await params;
    const [session] = await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, id))
      .limit(1);
    if (!session) {
      return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
    }

    const list = await db
      .select()
      .from(messages)
      .where(eq(messages.sessionId, id))
      .orderBy(asc(messages.createdAt));
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/sessions/[id]/messages:", err);
    return NextResponse.json({ error: "Failed to load messages" }, { status: 500 });
  }
}
