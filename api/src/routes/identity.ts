import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { requireAuth, requireTenantRole } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";
import { globalLimiter, registerRateLimit } from "../plugins/rateLimit.js";
import { seal } from "../lib/providers/sealed.js";

// Number-based identity KYC (PAN + Aadhaar OTP) against a licensed
// aggregator. Every route here can spend money, which shapes three things:
//
//   * the numbers are sealed (AES-GCM) before they enter a workflow argument,
//     because Temporal persists workflow inputs in its event history — see
//     lib/providers/sealed.ts;
//   * each route carries a per-caller rate limit and the OTP routes also sit
//     under a global hourly ceiling, so a scripted caller cannot outrun the
//     DB-backed monthly cap on its own;
//   * a 45-second workflow timeout, since a real aggregator call plus its
//     retries does not fit the 20-second default and abandoning it would mean
//     paying for an answer we then throw away.

const PROVIDER_TIMEOUT = "45 seconds";
const HOUR_MS = 60 * 60 * 1000;

// A PAN retype or a second document is normal; ten in an hour is not.
const PAN_PER_CALLER_MAX = 6;
// Deliberately tighter — each one can put an SMS on someone's phone.
const OTP_PER_CALLER_MAX = 4;
// Submits are cheap to get wrong and are additionally capped per session
// (MAX_OTP_ATTEMPTS in activities/identity.ts).
const OTP_SUBMIT_PER_CALLER_MAX = 10;

// Ceiling across every caller. The monthly cap in costGuard is the budget;
// this is what stops one bad hour from consuming it. Sized so ordinary
// traffic never reaches it.
const GLOBAL_IDENTITY_MAX_PER_HOUR = 60;
const allowGlobalIdentity = globalLimiter(GLOBAL_IDENTITY_MAX_PER_HOUR, HOUR_MS);

const panBody = z.object({
  // Format is re-checked server-side (validateIdentityNumber); this bound just
  // keeps obvious junk out of the workflow.
  panNumber: z.string().trim().min(10).max(12),
});

const aadhaarBody = z.object({
  aadhaarNumber: z.string().trim().min(12).max(16),
});

const otpBody = z.object({
  sessionId: z.string().uuid(),
  otp: z.string().trim().regex(/^\d{4,8}$/),
});

// Runs as a preHandler, i.e. after the per-caller limiter (an onRequest hook)
// has had its say — a caller already over their own budget must not get to
// spend from the shared one. Same ordering as routes/contact.ts.
async function globalGate(_req: FastifyRequest, reply: FastifyReply) {
  if (!allowGlobalIdentity()) {
    return reply.code(429).send({ error: "rate_limited" });
  }
}

export async function identityRoutes(app: FastifyInstance) {
  await registerRateLimit(app);

  // --- Tenant verifying themselves ---------------------------------------

  app.post(
    "/identity/pan",
    {
      preHandler: [requireAuth, requireTenantRole],
      schema: { body: panBody },
      config: { rateLimit: { max: PAN_PER_CALLER_MAX, timeWindow: HOUR_MS } },
    },
    async (req, reply) => {
      const { panNumber } = req.body as z.infer<typeof panBody>;
      return sendWorkflow(
        reply,
        "verifyPanWorkflow",
        [
          {
            sealedPan: seal(panNumber),
            subject: { tenantUserId: req.userId! },
            callerUserId: req.userId!,
            callerRole: "tenant",
          },
        ],
        200,
        { workflowExecutionTimeout: PROVIDER_TIMEOUT },
      );
    },
  );

  app.post(
    "/identity/aadhaar/otp",
    {
      preHandler: [requireAuth, requireTenantRole, globalGate],
      schema: { body: aadhaarBody },
      config: { rateLimit: { max: OTP_PER_CALLER_MAX, timeWindow: HOUR_MS } },
    },
    async (req, reply) => {
      const { aadhaarNumber } = req.body as z.infer<typeof aadhaarBody>;
      return sendWorkflow(
        reply,
        "sendAadhaarOtpWorkflow",
        [
          {
            sealedAadhaar: seal(aadhaarNumber),
            subject: { tenantUserId: req.userId! },
            callerUserId: req.userId!,
            callerRole: "tenant",
          },
        ],
        200,
        {
          workflowExecutionTimeout: PROVIDER_TIMEOUT,
          // One OTP request per user in flight at a time. Temporal rejects a
          // duplicate workflow id while the first is still running, so a
          // double-clicked button cannot race two sessions past the
          // live-session check inside the workflow.
          workflowId: `sendAadhaarOtp-${req.userId}`,
        },
      );
    },
  );

  app.post(
    "/identity/aadhaar/verify",
    {
      preHandler: [requireAuth, requireTenantRole],
      schema: { body: otpBody },
      config: { rateLimit: { max: OTP_SUBMIT_PER_CALLER_MAX, timeWindow: HOUR_MS } },
    },
    async (req, reply) => {
      const { sessionId, otp } = req.body as z.infer<typeof otpBody>;
      return sendWorkflow(
        reply,
        "verifyAadhaarOtpWorkflow",
        [
          {
            sessionId,
            sealedOtp: seal(otp),
            subject: { tenantUserId: req.userId! },
            callerUserId: req.userId!,
            callerRole: "tenant",
          },
        ],
        200,
        { workflowExecutionTimeout: PROVIDER_TIMEOUT },
      );
    },
  );

  app.get("/identity/verifications", { preHandler: [requireAuth, requireTenantRole] }, async (req, reply) => {
    return sendWorkflow(reply, "listIdentityVerificationsForTenantUserWorkflow", [{ tenantUserId: req.userId! }]);
  });

  // --- Owner verifying a tenant record they hold --------------------------
  //
  // PAN only. There is no owner-initiated Aadhaar route on purpose: the OTP
  // goes to the tenant's own phone and completing it requires them, so a
  // landlord-driven Aadhaar flow would either not work or would mean the
  // landlord handling someone else's OTP. The tenant runs that one themselves
  // and the result becomes visible to the linked landlord.

  app.post(
    "/tenants/:id/identity/pan",
    {
      preHandler: requireAuth,
      schema: { body: panBody },
      config: { rateLimit: { max: PAN_PER_CALLER_MAX, timeWindow: HOUR_MS } },
    },
    async (req, reply) => {
      const { id } = req.params as { id: string };
      const { panNumber } = req.body as z.infer<typeof panBody>;
      return sendWorkflow(
        reply,
        "verifyPanWorkflow",
        [
          {
            sealedPan: seal(panNumber),
            subject: { tenantId: id },
            callerUserId: req.userId!,
            callerRole: "owner",
          },
        ],
        200,
        { workflowExecutionTimeout: PROVIDER_TIMEOUT },
      );
    },
  );

  app.get("/tenants/:id/identity-verifications", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "listIdentityVerificationsForTenantWorkflow", [
      { tenantId: id, ownerId: req.userId! },
    ]);
  });
}
