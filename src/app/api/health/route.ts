import { db } from "@/db";
import { sql } from "drizzle-orm";
import {
  isAdminAutoLoginEnabled,
  isAdminBypassConfigured,
} from "@/lib/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      model: process.env.BLUESMINDS_MODEL || "gpt_5_4",
      adminBypass: {
        configured: isAdminBypassConfigured(),
        autoLogin: isAdminAutoLoginEnabled(),
      },
    });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
