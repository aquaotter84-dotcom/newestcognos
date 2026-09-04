import { NextResponse } from "next/server";
import { db } from "@/db";
import { sessions } from "@/db/schema";
import { desc } from "drizzle-orm";
import { runtimeGuard } from "@/lib/guard";

export async function GET(request: Request) {
  const denied = runtimeGuard(request);
  if (denied) return denied;
  try {
    const list = await db
      .select()
      .from(sessions)
      .orderBy(desc(sessions.updatedAt))
      .limit(100);
    return NextResponse.json(list);
  } catch (err) {
    console.error("GET /api/sessions:", err);
    return NextResponse.json({ error: "Failed to load conversations" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = runtimeGuard(request);
  if (denied) return denied;
  try {
    const body = (await request.json().catch(() => ({}))) as { title?: string };
    const title =
      (typeof body.title === "string" && body.title.trim().slice(0, 120)) ||
      "New conversation";

    const [session] = await db
      .insert(sessions)
      .values({ title })
      .returning();
    return NextResponse.json(session, { status: 201 });
  } catch (err) {
    console.error("POST /api/sessions:", err);
    return NextResponse.json({ error: "Failed to create conversation" }, { status: 500 });
  }
}
