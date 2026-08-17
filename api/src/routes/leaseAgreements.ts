import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

// Owner-driven e-Sign lease agreement flow.
//
// Three steps on purpose, rather than one "create and send" call:
//   POST /leases/:id/agreement          → renders the PDF, free
//   GET  /leases/:id/agreement          → read it back, presigned, free
//   POST /lease-agreements/:id/send     → creates the paid e-Sign transaction
//
// Splitting generation from sending means the landlord reads the draft before
// anything is billed, and a re-read never costs anything. It also gives a
// deployment with no e-Sign vendor a working paper path.

const PDF_TIMEOUT = "60 seconds";
const PROVIDER_TIMEOUT = "90 seconds";

const roleParam = z.object({ role: z.enum(["landlord", "tenant"]) });

export async function leaseAgreementRoutes(app: FastifyInstance) {
  app.post("/leases/:id/agreement", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(
      reply,
      "createLeaseAgreementWorkflow",
      [{ leaseId: id, ownerId: req.userId! }],
      201,
      {
        workflowExecutionTimeout: PDF_TIMEOUT,
        // One draft per lease in flight. The partial unique index on
        // lease_agreements is the real guarantee; this just turns a
        // double-click into a clean 409 from Temporal instead of a
        // constraint violation.
        workflowId: `createLeaseAgreement-${id}`,
      },
    );
  });

  app.get("/leases/:id/agreement", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "getLeaseAgreementWorkflow", [{ leaseId: id, ownerId: req.userId! }]);
  });

  app.post("/lease-agreements/:id/send", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(
      reply,
      "sendLeaseAgreementWorkflow",
      [{ agreementId: id, ownerId: req.userId! }],
      200,
      { workflowExecutionTimeout: PROVIDER_TIMEOUT, workflowId: `sendLeaseAgreement-${id}` },
    );
  });

  // Signing links expire at the provider, so this mints a fresh one rather
  // than handing back a stored link that may already be dead. Open to both
  // parties — the activity checks that the caller is the signer whose link
  // they're asking for, and 404s otherwise.
  app.get("/lease-agreements/:id/sign-url/:role", { preHandler: requireAuth }, async (req, reply) => {
    const { id, role } = req.params as { id: string; role: string };
    const parsed = roleParam.safeParse({ role });
    if (!parsed.success) return reply.code(400).send({ error: "invalid_role" });

    return sendWorkflow(
      reply,
      "refreshSignUrlWorkflow",
      [{ agreementId: id, role: parsed.data.role, requesterUserId: req.userId! }],
      200,
      { workflowExecutionTimeout: PROVIDER_TIMEOUT },
    );
  });
}
