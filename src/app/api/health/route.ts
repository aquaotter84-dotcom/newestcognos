import { db } from "@/db";
import { sql } from "drizzle-orm";
import { runtimeGuard } from "@/lib/guard";
import { activeModel } from "@/lib/llm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const denied = runtimeGuard(request);
  if (denied) return denied;
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, model: activeModel() });
  } catch (err) {
    const message = err instanceof Error ? err.message : "database unavailable";
    return Response.json({ ok: false, error: message }, { status: 500 });
  }
}
