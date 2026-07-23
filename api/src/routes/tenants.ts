import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

const tenantBody = z.object({
  fullName: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  kycStatus: z.enum(["pending", "submitted", "verified"]).default("pending"),
  notes: z.string().optional(),
});

// Owner-side tenant records — owner_id = me pattern, same as properties.ts.
// Business logic runs in tenantsWorkflow-family Temporal workflows
// (api/src/temporal/workflows/tenants.ts).
export async function tenantRoutes(app: FastifyInstance) {
  app.get("/tenants", { preHandler: requireAuth }, async (req, reply) => {
    return sendWorkflow(reply, "listTenantsWorkflow", [{ ownerId: req.userId! }]);
  });

  app.post("/tenants", { preHandler: requireAuth, schema: { body: tenantBody } }, async (req, reply) => {
    return sendWorkflow(
      reply,
      "createTenantWorkflow",
      [{ ownerId: req.userId!, body: req.body as z.infer<typeof tenantBody> }],
      201,
    );
  });

  app.get("/tenants/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "getTenantWorkflow", [{ id, ownerId: req.userId! }]);
  });

  app.patch(
    "/tenants/:id",
    { preHandler: requireAuth, schema: { body: tenantBody.partial() } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      return sendWorkflow(reply, "updateTenantWorkflow", [
        { id, ownerId: req.userId!, body: req.body as Partial<z.infer<typeof tenantBody>> },
      ]);
    },
  );

  app.delete("/tenants/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "deleteTenantWorkflow", [{ id, ownerId: req.userId! }], 204);
  });
}
