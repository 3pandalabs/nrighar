import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

const createBody = z.object({
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  amountDue: z.number().nonnegative(),
});

// Ports 0005_upi_pay_links.sql's three SECURITY DEFINER RPCs. The pay_links
// table itself has no anon grants in the old schema — here that's just "no
// requireAuth on these three routes" plus the id being an unguessable UUID.
// Anonymous callers can only ever hit these narrow routes, never a generic
// pay_links CRUD endpoint (there isn't one).
export async function payLinkRoutes(app: FastifyInstance) {
  app.get("/pay-links", { preHandler: requireAuth }, async (req, reply) => {
    const { leaseId } = req.query as { leaseId?: string };
    return sendWorkflow(reply, "listPayLinksWorkflow", [{ ownerId: req.userId!, leaseId }]);
  });

  app.post(
    "/leases/:leaseId/pay-links",
    { preHandler: requireAuth, schema: { body: createBody } },
    async (req, reply) => {
      const { leaseId } = req.params as { leaseId: string };
      const body = req.body as z.infer<typeof createBody>;
      return sendWorkflow(reply, "createPayLinkWorkflow", [{ ownerId: req.userId!, leaseId, ...body }], 201);
    },
  );

  app.get("/pay-links/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    return sendWorkflow(reply, "getPayLinkWorkflow", [{ token }]);
  });

  app.post("/pay-links/:token/open", async (req, reply) => {
    const { token } = req.params as { token: string };
    return sendWorkflow(reply, "openPayLinkWorkflow", [{ token }], 204);
  });

  app.post("/pay-links/:token/claim-paid", async (req, reply) => {
    const { token } = req.params as { token: string };
    return sendWorkflow(reply, "claimPayLinkPaidWorkflow", [{ token }], 204);
  });
}
