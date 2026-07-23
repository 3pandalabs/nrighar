import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireTenantRole } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

const createBody = z.object({ propertyId: z.string().uuid().optional() });

export async function intakeLinkRoutes(app: FastifyInstance) {
  app.get("/intake-links", { preHandler: requireAuth }, async (req, reply) => {
    return sendWorkflow(reply, "listIntakeLinksWorkflow", [{ ownerId: req.userId! }]);
  });

  app.post("/intake-links", { preHandler: requireAuth, schema: { body: createBody } }, async (req, reply) => {
    const { propertyId } = req.body as z.infer<typeof createBody>;
    return sendWorkflow(reply, "createIntakeLinkWorkflow", [{ ownerId: req.userId!, propertyId }], 201);
  });

  app.get("/intake-links/:token", async (req, reply) => {
    const { token } = req.params as { token: string };
    return sendWorkflow(reply, "getIntakeLinkWorkflow", [{ token }]);
  });

  app.post(
    "/intake-links/:token/accept",
    { preHandler: [requireAuth, requireTenantRole] },
    async (req, reply) => {
      const { token } = req.params as { token: string };
      return sendWorkflow(reply, "acceptIntakeLinkWorkflow", [{ token, tenantUserId: req.userId! }]);
    },
  );

  app.delete("/intake-links/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "deleteIntakeLinkWorkflow", [{ id, ownerId: req.userId! }], 204);
  });
}
