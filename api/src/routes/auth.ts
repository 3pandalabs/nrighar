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

const forgotPasswordBody = z.object({ email: z.string().email().max(320) });

const resetPasswordBody = z.object({
  token: z.string().min(1).max(500),
  password: z.string().min(8),
});

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

  // Unauthenticated by design — the caller has lost their password. Answers
  // 204 whether or not the address has an account; see the activity for why.
  app.post("/auth/forgot-password", { schema: { body: forgotPasswordBody } }, async (req, reply) => {
    return sendWorkflow(reply, "requestPasswordResetWorkflow", [req.body as z.infer<typeof forgotPasswordBody>], 204);
  });

  // The token from the emailed link is the only credential. min(8) matches
  // signup's rule so a reset can't land on a password that signup would have
  // rejected.
  app.post("/auth/reset-password", { schema: { body: resetPasswordBody } }, async (req, reply) => {
    return sendWorkflow(reply, "resetPasswordWorkflow", [req.body as z.infer<typeof resetPasswordBody>], 204);
  });

  app.get("/auth/me", { preHandler: requireAuth }, async (req, reply) => {
    return sendWorkflow(reply, "getMeWorkflow", [{ userId: req.userId!, userRole: req.userRole! }]);
  });
}
