import { timingSafeEqual } from "node:crypto";
import { sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { db } from "../db/index.js";
import { env } from "../env.js";
import { cpuPercentOfOneCore, requestsLastHour } from "../metrics/collector.js";

// Ops-only endpoint, scraped by the admin page (admin.3pandalabs.com). The
// admin Worker calls this server-side and holds the token as a Worker secret,
// so it never reaches a browser.
//
// Deliberately outside the product API surface: no JWT, its own bearer token,
// and aggregate counts only — nothing here identifies a user. Keep it that way;
// the response is proxied to a page whose only gate is Cloudflare Access.
//
// This is also the one route that does NOT hand off to a Temporal workflow.
// Metrics are an infrastructure read, not business logic — routing them through
// Temporal would add a workflow execution to the history on every dashboard
// poll and would report the API's resource usage through a hop that has its own.

function tokenMatches(presented: string, expected: string): boolean {
  const a = Buffer.from(presented);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on length mismatch, so compare lengths first — the
  // length of a secret is not the part worth hiding.
  return a.length === b.length && timingSafeEqual(a, b);
}

type CountsRow = {
  users: number;
  profiles: number;
  properties: number;
  tenants: number;
  active_leases: number;
  active_sessions: number;
};

type DatabaseRow = {
  size_bytes: string;
  size_pretty: string;
  connections: number;
};

export async function metricsRoutes(app: FastifyInstance) {
  app.get("/metrics", async (req, reply) => {
    if (!env.METRICS_TOKEN) {
      // Unset rather than wrong: the container still boots without the env var
      // so a deploy can never be bricked by a missing ops secret.
      return reply.code(503).send({ error: "metrics_disabled" });
    }

    const header = req.headers.authorization ?? "";
    const presented = header.startsWith("Bearer ") ? header.slice(7) : "";
    if (!tokenMatches(presented, env.METRICS_TOKEN)) {
      return reply.code(401).send({ error: "unauthorized" });
    }

    const counts = await db.execute<CountsRow>(sql`
      select
        (select count(*) from users)::int as users,
        (select count(*) from profiles)::int as profiles,
        (select count(*) from properties)::int as properties,
        (select count(*) from tenants)::int as tenants,
        (select count(*) from leases where status = 'active')::int as active_leases,
        (select count(*) from sessions where expires_at > now())::int as active_sessions
    `);

    const database = await db.execute<DatabaseRow>(sql`
      select
        pg_database_size(current_database()) as size_bytes,
        pg_size_pretty(pg_database_size(current_database())) as size_pretty,
        (select count(*) from pg_stat_activity where datname = current_database())::int as connections
    `);

    const c = counts.rows[0];
    const d = database.rows[0];
    const mem = process.memoryUsage();

    return {
      app: "nrighar",
      collectedAt: new Date().toISOString(),
      uptimeSeconds: Math.round(process.uptime()),
      counts: {
        users: c.users,
        profiles: c.profiles,
        properties: c.properties,
        tenants: c.tenants,
        activeLeases: c.active_leases,
        activeSessions: c.active_sessions,
      },
      traffic: {
        // Rolling 60 minutes, in-process — see metrics/collector.ts. Resets on
        // restart, and counts only this replica.
        apiRequestsLastHour: requestsLastHour(),
      },
      process: {
        // The Fastify container only. The Temporal worker runs in its own
        // container and is not covered here.
        rssBytes: mem.rss,
        heapUsedBytes: mem.heapUsed,
        cpuPercentOfOneCore: cpuPercentOfOneCore(),
      },
      database: {
        sizeBytes: Number(d.size_bytes),
        sizePretty: d.size_pretty,
        connections: d.connections,
      },
    };
  });
}
