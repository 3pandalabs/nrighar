import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";
import { registerRateLimit } from "../plugins/rateLimit.js";

// BBPS utility tracking. All owner-scoped; a tenant never sees these routes,
// since the point is the landlord watching bills on a property they can't walk
// over and check.

const HOUR_MS = 60 * 60 * 1000;
// The only route here that can spend money. A landlord checking a bill by hand
// a few times an hour is plausible; more than that is a script.
const MANUAL_FETCH_PER_CALLER_MAX = 10;

const accountBody = z.object({
  propertyId: z.string().uuid(),
  category: z.enum(["electricity", "water", "gas", "broadband", "dth", "mobile", "maintenance", "other"]),
  billerId: z.string().trim().min(1).max(64),
  billerName: z.string().trim().max(200).optional(),
  consumerNumber: z.string().trim().min(3).max(64),
  nickname: z.string().trim().max(120).optional(),
});

const accountPatchBody = accountBody.partial().omit({ propertyId: true }).extend({ active: z.boolean().optional() });

export async function utilityRoutes(app: FastifyInstance) {
  await registerRateLimit(app);

  app.get("/utility-accounts", { preHandler: requireAuth }, async (req, reply) => {
    const { propertyId } = req.query as { propertyId?: string };
    return sendWorkflow(reply, "listUtilityAccountsWorkflow", [{ ownerId: req.userId!, propertyId }]);
  });

  app.post(
    "/utility-accounts",
    { preHandler: requireAuth, schema: { body: accountBody } },
    async (req, reply) => {
      return sendWorkflow(
        reply,
        "createUtilityAccountWorkflow",
        [{ ownerId: req.userId!, body: req.body as z.infer<typeof accountBody> }],
        201,
      );
    },
  );

  app.patch(
    "/utility-accounts/:id",
    { preHandler: requireAuth, schema: { body: accountPatchBody } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      return sendWorkflow(reply, "updateUtilityAccountWorkflow", [
        { id, ownerId: req.userId!, body: req.body as z.infer<typeof accountPatchBody> },
      ]);
    },
  );

  app.delete("/utility-accounts/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "deleteUtilityAccountWorkflow", [{ id, ownerId: req.userId! }], 204);
  });

  app.get("/utility-bills", { preHandler: requireAuth }, async (req, reply) => {
    const { accountId } = req.query as { accountId?: string };
    return sendWorkflow(reply, "listUtilityBillsWorkflow", [{ ownerId: req.userId!, accountId }]);
  });

  // Manual override for the scheduled fetch. Subject to the same monthly cap
  // and 6-hour per-account cooldown as the cron — those live in the activity,
  // so there is no path to the provider that skips them.
  app.post(
    "/utility-accounts/:id/fetch",
    {
      preHandler: requireAuth,
      config: { rateLimit: { max: MANUAL_FETCH_PER_CALLER_MAX, timeWindow: HOUR_MS } },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      return sendWorkflow(
        reply,
        "fetchUtilityBillNowWorkflow",
        [{ accountId: id, ownerId: req.userId! }],
        200,
        {
          workflowExecutionTimeout: "60 seconds",
          // One in-flight fetch per account, so a double-click can't race two
          // calls past the cooldown check.
          workflowId: `fetchUtilityBillNow-${id}`,
        },
      );
    },
  );
}
