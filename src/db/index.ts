import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

type DrizzlePg = ReturnType<typeof drizzle>;

const globalForDb = globalThis as typeof globalThis & {
  __cognosPool?: Pool;
  __cognosDb?: DrizzlePg;
};

function getDb(): DrizzlePg {
  if (!globalForDb.__cognosDb) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is not set. Set it in .env (local) or Vercel environment variables, then apply the schema with `npm run db:push`."
      );
    }

    // Neon/Vercel-friendly defaults: keep the per-instance pool small so a
    // single serverless function never exhausts the database's connections.
    const pool = new Pool({
      connectionString: databaseUrl,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    });

    // Idle clients can die (Neon pauses, cold starts, network blips).
    // Without this listener the unhandled "error" event would crash the
    // serverless function.
    pool.on("error", (err) => {
      console.error("pg pool idle client error:", err.message);
    });

    globalForDb.__cognosPool = pool;
    globalForDb.__cognosDb = drizzle(pool);
  }
  return globalForDb.__cognosDb;
}

/**
 * Lazy database handle.
 *
 * Importing this module NEVER connects to the database — the pool is created
 * only when the first query actually runs. That is what lets `next build`
 * succeed with DATABASE_URL unset, and surfaces a clear error at runtime
 * instead of at build time.
 */
export const db = new Proxy({} as DrizzlePg, {
  get(_target, prop) {
    const d = getDb();
    const value = (d as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(d) : value;
  },
});
