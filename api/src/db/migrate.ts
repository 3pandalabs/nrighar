// Applies drizzle/*.sql migrations. In production this runs automatically on
// every deploy via the api Dockerfile's CMD, as the compiled
// `node dist/db/migrate.js` (`npm run db:migrate:prod`) — the runtime image is
// --omit=dev and has no tsx/src, so the `npm run db:migrate` (tsx) script is
// dev/local-only.
//
// Migrations run as a PRIVILEGED role, NOT the runtime role. The app's
// DATABASE_URL (src/db/index.ts) is a least-privilege role that deliberately
// can't run DDL or touch drizzle's bookkeeping schema — running the migrator
// through it fails with "permission denied for schema drizzle" (42501). Set
// MIGRATION_DATABASE_URL to an owner/DDL role for migrations; it falls back to
// DATABASE_URL for local/dev where a single superuser role is used.
//
// Kept dependency-light (own pool, no env.ts import) so the compiled output
// runs under plain node with only prod deps and without requiring the full
// runtime env (JWT/R2/etc.) just to migrate.
import "dotenv/config";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Pool } from "pg";

const connectionString = process.env.MIGRATION_DATABASE_URL ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("MIGRATION_DATABASE_URL (preferred) or DATABASE_URL is required to run migrations");
}

const pool = new Pool({ connectionString });
const db = drizzle(pool);

await migrate(db, { migrationsFolder: "./drizzle" });
await pool.end();
console.log("Migrations applied.");
