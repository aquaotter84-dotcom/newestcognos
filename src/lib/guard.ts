import { createHash, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * Optional server-side guard — there is no account system in COGNOS.
 *
 * When COGNOS_RUNTIME_SECRET is set, every /api route must be called with a
 * matching `x-cognos-secret` header (constant-time comparison). When the
 * variable is unset, routes are open. This is an out-of-band protection for
 * the instance owner — it has no UI and no client-side counterpart.
 */
const HEADER = "x-cognos-secret";

function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function isRuntimeSecretConfigured(): boolean {
  const secret = process.env.COGNOS_RUNTIME_SECRET;
  return Boolean(secret && secret.trim().length > 0);
}

export function runtimeGuard(request: Request): NextResponse | null {
  const expected = process.env.COGNOS_RUNTIME_SECRET;
  if (!expected || expected.trim().length === 0) return null;
  const provided = request.headers.get(HEADER) ?? "";
  if (!provided || !safeEqual(expected, provided)) {
    return NextResponse.json(
      { error: "Forbidden" },
      { status: 403, headers: { "Cache-Control": "no-store" } }
    );
  }
  return null;
}
