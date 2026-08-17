import type { FastifyInstance } from "fastify";
import { getESignProvider } from "../lib/esign/index.js";
import { startWorkflowDetached } from "../temporal/runWorkflow.js";

// Public, unauthenticated endpoint — the e-Sign provider posts here when a
// signature lands. Everything about it is shaped by that being the case.
//
// SIGNATURE VERIFICATION IS THE ONLY AUTHENTICATION. The handler's effect is
// to mark a lease agreement as legally signed and to file a signed PDF, so an
// unverified caller must never reach it. Verification is HMAC over the RAW
// request bytes, which is why this plugin installs its own buffer-mode JSON
// parser: Fastify's default parser hands back a parsed object, and
// re-serializing it would not reproduce the provider's exact bytes (key order
// and whitespace are not preserved), so the digest would never match.
//
// A missing webhook secret fails every delivery closed. That is a real
// operational hazard — signatures complete and RentVault never hears about it
// — and it is still the right call: the alternative is an endpoint anyone can
// POST a "completed" event to.
//
// The route acks and gets out of the way: the actual handling runs in a
// detached workflow, keyed so a redelivery collapses onto the same execution.
// Providers retry anything they don't get a fast 2xx for, and a slow handler
// is how one event becomes ten.

export async function esignWebhookRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/json", { parseAs: "buffer" }, (_req, body, done) => {
    // Deliberately does NOT parse. req.body is the raw Buffer, and parsing
    // happens after the signature check below.
    done(null, body);
  });

  app.post("/webhooks/esign", async (req, reply) => {
    const provider = getESignProvider();
    if (!provider) {
      // Nothing is configured to send us this. 404 rather than 503: an
      // endpoint that answers "not configured" tells an unauthenticated
      // caller which features a deployment has.
      return reply.code(404).send({ error: "not_found" });
    }

    const rawBody = req.body as Buffer;
    if (!Buffer.isBuffer(rawBody) || !provider.verifyWebhookSignature({ rawBody, headers: req.headers })) {
      req.log.warn({ ip: req.ip }, "esign webhook: signature verification failed");
      return reply.code(401).send({ error: "invalid_signature" });
    }

    let payload: unknown;
    try {
      payload = JSON.parse(rawBody.toString("utf8"));
    } catch {
      return reply.code(400).send({ error: "invalid_body" });
    }

    const event = provider.parseWebhook(payload);

    try {
      await startWorkflowDetached(
        "handleEsignWebhookWorkflow",
        [
          {
            provider: provider.name,
            eventId: event.eventId,
            eventType: event.type,
            referenceId: event.referenceId,
            providerRef: event.providerRef,
            signerRole: event.signerRole,
            signedAt: event.signedAt ? event.signedAt.toISOString() : null,
            payload: event.raw,
          },
        ],
        { workflowId: `esign-webhook-${provider.name}-${event.eventId}` },
      );
    } catch (err) {
      // A duplicate workflow id means this delivery is already being handled.
      // That is the dedupe working, not a failure — ack it.
      const alreadyStarted = err instanceof Error && /already started|WorkflowExecutionAlreadyStarted/i.test(err.message);
      if (!alreadyStarted) {
        req.log.error(err, "esign webhook: failed to start handler workflow");
        // 500 so the provider retries. Losing a completion event silently is
        // worse than being redelivered — the dedupe handles redelivery.
        return reply.code(500).send({ error: "internal_error" });
      }
    }

    return reply.code(202).send({ received: true });
  });
}
