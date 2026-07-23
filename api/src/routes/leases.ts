import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

const leaseBody = z.object({
  propertyId: z.string().uuid(),
  tenantId: z.string().uuid(),
  rentAmount: z.number().positive(),
  depositAmount: z.number().nonnegative().optional(),
  startDate: z.string(),
  endDate: z.string().optional(),
  rentDueDay: z.number().int().min(1).max(28).default(1),
  status: z.enum(["active", "ended"]).default("active"),
});

export async function leaseRoutes(app: FastifyInstance) {
  app.get("/leases", { preHandler: requireAuth }, async (req, reply) => {
    return sendWorkflow(reply, "listLeasesWorkflow", [{ ownerId: req.userId! }]);
  });

  app.post("/leases", { preHandler: requireAuth, schema: { body: leaseBody } }, async (req, reply) => {
    return sendWorkflow(
      reply,
      "createLeaseWorkflow",
      [{ ownerId: req.userId!, body: req.body as z.infer<typeof leaseBody> }],
      201,
    );
  });

  app.get("/leases/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "getLeaseWorkflow", [{ id, ownerId: req.userId! }]);
  });

  app.patch(
    "/leases/:id",
    { preHandler: requireAuth, schema: { body: leaseBody.partial() } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      return sendWorkflow(reply, "updateLeaseWorkflow", [
        { id, ownerId: req.userId!, body: req.body as Partial<z.infer<typeof leaseBody>> },
      ]);
    },
  );

  app.delete("/leases/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "deleteLeaseWorkflow", [{ id, ownerId: req.userId! }], 204);
  });
}
