import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const globalForDb = globalThis as typeof globalThis & {
  __cognosPool?: Pool;
  __cognosDb?: ReturnType<typeof drizzle>;
};

function getDb(): ReturnType<typeof drizzle> {
  if (!globalForDb.__cognosDb) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error(
        "DATABASE_URL is required. Add it to your environment variables (Vercel Settings > Environment Variables), or set it in .env for local development."
      );
    }

    // Neon/Vercel defaults: keep the per-instance pool small so a single
    // serverless function doesn't exhaust Neon's connection limit. Use the
    // *pooled* connection string in Vercel; the direct string is fine locally.
    const max = Math.max(
      1,
      Math.min(20, Number(process.env.DATABASE_POOL_MAX || 10))
    );
    const idleTimeoutMillis = Number(
      process.env.DATABASE_POOL_IDLE_MS || 30000
    );

    const pool = new Pool({
      connectionString: databaseUrl,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis: Number(
        process.env.DATABASE_CONNECTION_TIMEOUT_MS || 10000
      ),
    });
    // Idle clients can die (Neon pauses its serverless DB, cold starts,
    // network blips). Without this listener the "error" event is unhandled
    // and crashes the serverless function on Vercel.
    pool.on("error", (err) => {
      console.error("pg pool idle client error:", err.message);
    });
    globalForDb.__cognosPool = pool;
    globalForDb.__cognosDb = drizzle(pool);
  }
  return globalForDb.__cognosDb;
}

// Lazy proxy: the database is only created when a query actually runs.
// This keeps builds working before DATABASE_URL is set, and surfaces a
// clear error at runtime instead of failing the build.
export const db = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const d = getDb();
    const value = (d as unknown as Record<string | symbol, unknown>)[prop];
    return typeof value === "function" ? value.bind(d) : value;
  },
});
