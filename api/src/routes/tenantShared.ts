import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

// The two share-conditional owner-reads (tenant_profiles_select_shared /
// tenant_documents_select_shared). Authorization + business logic run in the
// tenantShared-family Temporal workflows.
export async function tenantSharedRoutes(app: FastifyInstance) {
  app.get("/tenant-profiles/by-owner/:tenantUserId", { preHandler: requireAuth }, async (req, reply) => {
    const { tenantUserId } = req.params as { tenantUserId: string };
    return sendWorkflow(reply, "getTenantProfileByOwnerWorkflow", [{ tenantUserId, ownerId: req.userId! }]);
  });

  app.get("/tenant-documents/by-owner/:tenantUserId", { preHandler: requireAuth }, async (req, reply) => {
    const { tenantUserId } = req.params as { tenantUserId: string };
    return sendWorkflow(reply, "listTenantDocumentsByOwnerWorkflow", [{ tenantUserId, ownerId: req.userId! }]);
  });
}
