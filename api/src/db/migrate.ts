// Applies drizzle/*.sql migrations. In production this runs automatically on
// every deploy via the api Dockerfile's CMD, as the compiled
// `node dist/db/migrate.js` (`npm run db:migrate:prod`) — the runtime image is
// --omit=dev and has no tsx/src, so the `npm run db:migrate` (tsx) script is
// dev/local-only.
//
// Migrations run as the SAME role as the runtime (DATABASE_URL). Prod has no
// privileged/least-privilege role split, despite what this comment claimed
// before 2026-07-25: `nrighar_app` owns the `nrighar` database, every table in
// public, and holds CREATE on public — it runs DDL fine.
//
// MIGRATION_DATABASE_URL is kept as an escape hatch for environments that do
// separate the roles, but LEAVE IT UNSET in prod. Pointing it at the `postgres`
// superuser actively breaks things: the database has no default privileges
// configured (`\ddp` is empty), so tables created by a superuser run would be
// owned by `postgres` and the runtime role would then fail 42501 on them.
//
// Historical gotcha (fixed 2026-07-25): the `drizzle` bookkeeping schema and
// drizzle.__drizzle_migrations were owned by `postgres` — created by a stray
// superuser migration run — so migrate-on-start crash-looped with "permission
// denied for schema drizzle" (42501). Fixed on the box with
// `ALTER SCHEMA drizzle OWNER TO nrighar_app;` plus the same ALTER on the
// table. If a fresh environment hits 42501 here, check schema ownership
// (`\dn+`) before reaching for a superuser connection string.
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
