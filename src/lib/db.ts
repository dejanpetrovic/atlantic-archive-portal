import "server-only";
import postgres from "postgres";

// Single shared connection pool, created lazily on first query and reused
// across hot reloads in dev. prepare: false — the pooled Supabase connection
// string goes through pgbouncer in transaction mode, which does not support
// prepared statements.
const globalForDb = globalThis as unknown as {
  pgPool?: ReturnType<typeof postgres>;
};

export function db(): ReturnType<typeof postgres> {
  if (!globalForDb.pgPool) {
    const url = process.env.SUPABASE_DB_URL;
    if (!url) throw new Error("SUPABASE_DB_URL is not set");
    globalForDb.pgPool = postgres(url, {
      prepare: false,
      max: 10,
      idle_timeout: 20,
      connect_timeout: 10,
    });
  }
  return globalForDb.pgPool;
}
