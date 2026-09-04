// Drizzle Kit configuration — used by `npm run db:generate|db:migrate|db:push`.
// The app itself never imports this; `next build` never touches the database.

const config = {
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    // Read from the environment at command time. The placeholder only keeps
    // the file valid when DATABASE_URL is unset (e.g. during `next build`).
    url: process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:5432/cognos",
  },
};

export default config;
