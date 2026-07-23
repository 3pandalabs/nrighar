import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

const patchBody = z.object({
  displayName: z.string().optional(),
  countryOfResidence: z.string().optional(),
  preferredCurrency: z.string().optional(),
  upiVpa: z.string().optional(),
  upiName: z.string().optional(),
});

export async function profileRoutes(app: FastifyInstance) {
  app.get("/profile", { preHandler: requireAuth }, async (req, reply) => {
    return sendWorkflow(reply, "getProfileWorkflow", [{ userId: req.userId! }]);
  });

  app.patch("/profile", { preHandler: requireAuth, schema: { body: patchBody } }, async (req, reply) => {
    return sendWorkflow(reply, "updateProfileWorkflow", [
      { userId: req.userId!, body: req.body as z.infer<typeof patchBody> },
    ]);
  });
}
