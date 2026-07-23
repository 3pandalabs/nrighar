import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

const propertyBody = z.object({
  nickname: z.string().min(1),
  addressLine1: z.string().min(1),
  addressLine2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(1),
  propertyType: z
    .enum(["apartment", "independent_house", "villa", "plot", "commercial"])
    .default("apartment"),
  notes: z.string().optional(),
});

// Every route here is scoped `WHERE owner_id = req.userId` — this is the
// "owner_id = me" RLS-policy pattern, reproduced consistently across
// properties/tenants/leases/rent_payments/documents/pay_links/intake_links.
// A row that exists but belongs to someone else 404s, not 403s (don't leak
// existence). Business logic runs in propertiesWorkflow-family Temporal
// workflows (api/src/temporal/workflows/properties.ts) — this handler just
// validates input and translates the workflow result to an HTTP response.
export async function propertyRoutes(app: FastifyInstance) {
  app.get("/properties", { preHandler: requireAuth }, async (req, reply) => {
    return sendWorkflow(reply, "listPropertiesWorkflow", [{ ownerId: req.userId! }]);
  });

  app.post("/properties", { preHandler: requireAuth, schema: { body: propertyBody } }, async (req, reply) => {
    return sendWorkflow(
      reply,
      "createPropertyWorkflow",
      [{ ownerId: req.userId!, body: req.body as z.infer<typeof propertyBody> }],
      201,
    );
  });

  app.get("/properties/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "getPropertyWorkflow", [{ id, ownerId: req.userId! }]);
  });

  app.patch(
    "/properties/:id",
    { preHandler: requireAuth, schema: { body: propertyBody.partial() } },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      return sendWorkflow(reply, "updatePropertyWorkflow", [
        { id, ownerId: req.userId!, body: req.body as Partial<z.infer<typeof propertyBody>> },
      ]);
    },
  );

  app.delete("/properties/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "deletePropertyWorkflow", [{ id, ownerId: req.userId! }], 204);
  });
}
