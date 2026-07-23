import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

const upsertBody = z.object({
  leaseId: z.string().uuid(),
  periodYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12),
  amountDue: z.number().nonnegative(),
  amountPaid: z.number().nonnegative().optional(),
  paidOn: z.string().optional(),
  method: z.enum(["bank_transfer", "upi", "cash", "other"]).optional(),
  status: z.enum(["due", "paid", "partial"]).default("due"),
  notes: z.string().optional(),
});

export async function rentPaymentRoutes(app: FastifyInstance) {
  app.get("/rent-payments", { preHandler: requireAuth }, async (req, reply) => {
    return sendWorkflow(reply, "listRentPaymentsWorkflow", [{ ownerId: req.userId! }]);
  });

  app.put("/rent-payments", { preHandler: requireAuth, schema: { body: upsertBody } }, async (req, reply) => {
    return sendWorkflow(reply, "upsertRentPaymentWorkflow", [
      { ownerId: req.userId!, body: req.body as z.infer<typeof upsertBody> },
    ]);
  });

  app.delete("/rent-payments/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "deleteRentPaymentWorkflow", [{ id, ownerId: req.userId! }], 204);
  });
}
