import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance, FastifyRequest } from "fastify";

// Rate limiting for the unauthenticated, mail-sending routes. Two layers,
// because neither one alone is enough here.
//
// LAYER 1 — per-caller. Keying this is the awkward part. The web frontend is a
// Cloudflare Worker that calls this API *server-side* over INTERNAL_API_URL, a
// DNS-only hostname (see web/src/lib/api/client.ts for why: same-zone
// orange-to-orange subrequests get 403'd). That request never traverses
// Cloudflare's proxy, so it arrives with no CF-Connecting-IP and req.ip is the
// Worker's egress address — identical for every visitor on the site. Keying on
// req.ip alone would therefore put the entire web frontend in one bucket and
// let the first spammer lock out everyone else.
//
// So the frontend forwards the visitor's real address as X-Client-IP and we
// prefer it. That header is NOT trustworthy: the origin's firewall admits all
// Cloudflare IP ranges, so anyone with a Worker of their own can reach
// api-internal directly and rotate X-Client-IP per request, minting a fresh
// bucket every time. It de-duplicates honest traffic; it does not stop an
// attacker. That is what layer 2 is for.
//
// LAYER 2 — a global ceiling on the route, counted across every caller and
// every key. This is the layer that actually bounds the damage: however many
// identities an attacker invents, the route as a whole can only emit so much
// mail per hour. The cost is honest and worth stating: someone determined can
// burn the global budget and make the contact form unavailable to real users
// until the window rolls over. For a route whose failure mode is "floods the
// one support inbox", capping the flood beats keeping the form up.
//
// Both layers are in-process. nrighar-api runs as a single container, so that
// is accurate today; the moment it is scaled to more than one replica these
// budgets become per-replica and want a shared store (@fastify/rate-limit takes
// a Redis client for exactly this).

type RateLimitError = Error & { statusCode: number; publicCode: string };

export function clientKey(req: FastifyRequest): string {
  const forwarded = req.headers["x-client-ip"];
  const value = Array.isArray(forwarded) ? forwarded[0] : forwarded;
  return value?.trim() || req.ip;
}

// A fixed window rather than a rolling one: one number, no per-key bookkeeping,
// and nothing that grows with the number of distinct callers. The edge case a
// fixed window brings — up to 2x the budget across a window boundary — does not
// matter at these volumes.
export function globalLimiter(max: number, windowMs: number) {
  let windowStart = Date.now();
  let count = 0;

  return function allow(): boolean {
    const now = Date.now();
    if (now - windowStart >= windowMs) {
      windowStart = now;
      count = 0;
    }
    if (count >= max) return false;
    count += 1;
    return true;
  };
}

// Register inside a route plugin's own encapsulated scope so the limiter
// applies only to that plugin's routes. `global: false` keeps it off every
// route that does not explicitly opt in via `config.rateLimit`.
export async function registerRateLimit(app: FastifyInstance) {
  await app.register(rateLimit, {
    global: false,
    keyGenerator: clientKey,
    // The plugin *throws* whatever this returns, and Fastify reads statusCode
    // off the thrown value — so returning a bare `{ error: "rate_limited" }`
    // object yields a 500, not a 429. It has to be an Error carrying the
    // status. `publicCode` is what index.ts's error handler renders as the
    // response body, keeping the app-wide `{ "error": "<code>" }` shape.
    errorResponseBuilder: (_req, context) => {
      const err = new Error(`rate limit exceeded, retry in ${context.after}`) as RateLimitError;
      err.statusCode = context.statusCode;
      err.publicCode = "rate_limited";
      return err;
    },
  });
}
