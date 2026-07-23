import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

const keyBody = z.object({ key: z.string().min(1) });

export async function storageRoutes(app: FastifyInstance) {
  app.post("/storage/presign-upload", { preHandler: requireAuth, schema: { body: keyBody } }, async (req, reply) => {
    const { key } = req.body as z.infer<typeof keyBody>;
    return sendWorkflow(reply, "presignUploadWorkflow", [{ key, userId: req.userId! }]);
  });

  app.post("/storage/presign-download", { preHandler: requireAuth, schema: { body: keyBody } }, async (req, reply) => {
    const { key } = req.body as z.infer<typeof keyBody>;
    return sendWorkflow(reply, "presignDownloadWorkflow", [{ key, userId: req.userId! }]);
  });
}
