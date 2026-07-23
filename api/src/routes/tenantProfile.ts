import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireTenantRole } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

const patchBody = z.object({
  fullName: z.string().min(1).optional(),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  currentCity: z.string().optional(),
  employer: z.string().optional(),
  kycStatus: z.enum(["pending", "submitted", "verified"]).optional(),
});

const docBody = z.object({
  docType: z.enum(["agreement", "kyc", "property_paper", "tax", "other"]).default("other"),
  title: z.string().min(1),
  storagePath: z.string().min(1),
});

// Tenant's own profile + documents — "self" pattern, keyed on user_id = me
// rather than owner_id = me (tenant_profiles_all_own / tenant_documents_all_own).
export async function tenantProfileRoutes(app: FastifyInstance) {
  app.get("/tenant-profile", { preHandler: [requireAuth, requireTenantRole] }, async (req, reply) => {
    return sendWorkflow(reply, "getTenantProfileWorkflow", [{ userId: req.userId! }]);
  });

  app.patch(
    "/tenant-profile",
    { preHandler: [requireAuth, requireTenantRole], schema: { body: patchBody } },
    async (req, reply) => {
      return sendWorkflow(reply, "updateTenantProfileWorkflow", [
        { userId: req.userId!, body: req.body as z.infer<typeof patchBody> },
      ]);
    },
  );

  app.get("/tenant-documents", { preHandler: [requireAuth, requireTenantRole] }, async (req, reply) => {
    return sendWorkflow(reply, "listTenantDocumentsWorkflow", [{ userId: req.userId! }]);
  });

  app.post(
    "/tenant-documents",
    { preHandler: [requireAuth, requireTenantRole], schema: { body: docBody } },
    async (req, reply) => {
      return sendWorkflow(
        reply,
        "createTenantDocumentWorkflow",
        [{ userId: req.userId!, body: req.body as z.infer<typeof docBody> }],
        201,
      );
    },
  );

  app.delete("/tenant-documents/:id", { preHandler: [requireAuth, requireTenantRole] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "deleteTenantDocumentWorkflow", [{ id, userId: req.userId! }], 204);
  });
}
