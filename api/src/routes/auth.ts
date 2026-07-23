import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

const signupBody = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["owner", "tenant"]).default("owner"),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string(),
});

const refreshBody = z.object({ refreshToken: z.string() });

export async function authRoutes(app: FastifyInstance) {
  app.post("/auth/signup", { schema: { body: signupBody } }, async (req, reply) => {
    return sendWorkflow(reply, "signupWorkflow", [req.body as z.infer<typeof signupBody>], 201);
  });

  app.post("/auth/login", { schema: { body: loginBody } }, async (req, reply) => {
    return sendWorkflow(reply, "loginWorkflow", [req.body as z.infer<typeof loginBody>]);
  });

  app.post("/auth/refresh", { schema: { body: refreshBody } }, async (req, reply) => {
    return sendWorkflow(reply, "refreshWorkflow", [req.body as z.infer<typeof refreshBody>]);
  });

  app.post("/auth/logout", { schema: { body: refreshBody } }, async (req, reply) => {
    return sendWorkflow(reply, "logoutWorkflow", [req.body as z.infer<typeof refreshBody>], 204);
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (req, reply) => {
    return sendWorkflow(reply, "getMeWorkflow", [{ userId: req.userId!, userRole: req.userRole! }]);
  });
}
