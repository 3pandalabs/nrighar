import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

const documentBody = z.object({
  propertyId: z.string().uuid().optional(),
  leaseId: z.string().uuid().optional(),
  docType: z.enum(["agreement", "kyc", "property_paper", "tax", "other"]).default("other"),
  title: z.string().min(1),
  storagePath: z.string().min(1),
});

// Owner-side document metadata rows. storagePath must be under the caller's
// own R2 key prefix — enforced by /storage/presign-upload requiring the same
// prefix, so a row here can only ever point at a file the caller could upload.
export async function documentRoutes(app: FastifyInstance) {
  app.get("/documents", { preHandler: requireAuth }, async (req, reply) => {
    return sendWorkflow(reply, "listDocumentsWorkflow", [{ ownerId: req.userId! }]);
  });

  app.post("/documents", { preHandler: requireAuth, schema: { body: documentBody } }, async (req, reply) => {
    return sendWorkflow(
      reply,
      "createDocumentWorkflow",
      [{ ownerId: req.userId!, body: req.body as z.infer<typeof documentBody> }],
      201,
    );
  });

  app.delete("/documents/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "deleteDocumentWorkflow", [{ id, ownerId: req.userId! }], 204);
  });
}
