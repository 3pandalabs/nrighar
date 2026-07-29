import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sendWorkflow } from "../temporal/runWorkflow.js";

const contactBody = z.object({
  name: z.string().min(1).max(120),
  email: z.string().email().max(320),
  message: z.string().min(1).max(4000),
});

// Public, unauthenticated — it's the contact page for people who may not have
// an account yet.
//
// NOTE: there is no rate limit or CAPTCHA on this route, so it is a spam relay
// into the support inbox for anyone who finds it. It relays to a fixed
// SUPPORT_EMAIL and never to a caller-supplied address, so it can't be used to
// mail arbitrary third parties — the blast radius is one inbox. Worth adding a
// limiter before this gets any real traffic; see ROUTES.md.
export async function contactRoutes(app: FastifyInstance) {
  app.post("/contact", { schema: { body: contactBody } }, async (req, reply) => {
    return sendWorkflow(reply, "sendContactMessageWorkflow", [req.body as z.infer<typeof contactBody>], 204);
  });
}
