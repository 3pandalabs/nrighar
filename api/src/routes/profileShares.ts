import type { FastifyInstance } from "fastify";
import { requireAuth, requireTenantRole } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

export async function profileShareRoutes(app: FastifyInstance) {
  app.get("/profile-shares", { preHandler: [requireAuth, requireTenantRole] }, async (req, reply) => {
    return sendWorkflow(reply, "listProfileSharesWorkflow", [{ tenantUserId: req.userId! }]);
  });

  app.post("/profile-shares", { preHandler: [requireAuth, requireTenantRole] }, async (req, reply) => {
    return sendWorkflow(reply, "createProfileShareWorkflow", [{ tenantUserId: req.userId! }], 201);
  });

  app.get("/profile-shares/:token/preview", { preHandler: requireAuth }, async (req, reply) => {
    const { token } = req.params as { token: string };
    return sendWorkflow(reply, "previewProfileShareWorkflow", [{ token }]);
  });

  app.post("/profile-shares/:token/claim", { preHandler: requireAuth }, async (req, reply) => {
    const { token } = req.params as { token: string };
    return sendWorkflow(reply, "claimProfileShareWorkflow", [{ token, ownerId: req.userId! }]);
  });

  app.post(
    "/profile-shares/:id/revoke",
    { preHandler: [requireAuth, requireTenantRole] },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      return sendWorkflow(reply, "revokeProfileShareWorkflow", [{ id, tenantUserId: req.userId! }]);
    },
  );
}
