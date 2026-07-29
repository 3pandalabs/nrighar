import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendWorkflow } from "../temporal/runWorkflow.js";
import { globalLimiter, registerRateLimit } from "../plugins/rateLimit.js";

const contactBody = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(320),
  message: z.string().min(1).max(4000),
});

const HOUR_MS = 60 * 60 * 1000;

// Per caller: enough for a follow-up or a corrected resend, not enough to
// script. Keyed on the X-Client-IP the web frontend forwards, falling back to
// req.ip for direct callers — see plugins/rateLimit.ts for why that header is
// needed and why it isn't trusted on its own.
const PER_CALLER_MAX = 5;

// Across everyone. Sized against what this route is actually for: a handful of
// contact messages a day, so an hour of real traffic never comes close, while a
// flood stops at 40 mails instead of however many the sender felt like sending.
const GLOBAL_MAX_PER_HOUR = 40;

const allowGlobal = globalLimiter(GLOBAL_MAX_PER_HOUR, HOUR_MS);

// Public, unauthenticated — it's the contact page for people who may not have
// an account yet. It relays to a fixed SUPPORT_EMAIL and never to a
// caller-supplied address, so it can't be used to mail arbitrary third parties;
// the blast radius is one inbox, and the two limits above are what bound it.
export async function contactRoutes(app: FastifyInstance) {
  await registerRateLimit(app);

  app.post(
    "/contact",
    {
      schema: { body: contactBody },
      config: { rateLimit: { max: PER_CALLER_MAX, timeWindow: HOUR_MS } },
      // Checked in preHandler, i.e. after the per-caller limiter (an onRequest
      // hook) has already had its say: a caller who is over their own budget
      // must not get to spend from the shared one.
      preHandler: async (_req, reply) => {
        if (!allowGlobal()) {
          return reply.code(429).send({ error: "rate_limited" });
        }
      },
    },
    async (req, reply) => {
      return sendWorkflow(reply, "sendContactMessageWorkflow", [req.body as z.infer<typeof contactBody>], 204);
    },
  );
}
