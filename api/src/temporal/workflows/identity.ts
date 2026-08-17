import { proxyActivities } from "@temporalio/workflow";
import { ApplicationFailure } from "@temporalio/common";
import type * as activities from "../activities/index.js";
import type { IdentitySubject } from "../activities/identity.js";

const {
  validateIdentityNumber,
  findCachedIdentityVerification,
  callPanVerification,
  callAadhaarOtp,
  findLiveAadhaarOtpSession,
  claimAadhaarOtpAttempt,
  callAadhaarOtpVerify,
  persistIdentityVerification,
  scoreNameMatch,
  listIdentityVerificationsForTenant,
  listIdentityVerificationsForTenantUser,
} = proxyActivities<typeof activities>({
  // Long enough for one provider call plus its bounded retries.
  startToCloseTimeout: "60 seconds",
  // ONE attempt. This is the important line in the file: an activity that
  // spends money must not be retried by the framework, because Temporal's
  // retry has no idea a call was billed. Retry policy for these calls lives
  // inside providerFetch, where it can tell a connection failure (safe, free)
  // from a timeout (already paid for). A genuinely lost result is re-run by a
  // human pressing the button again — which the cache and cooldown then make
  // cheap or free.
  retry: { maximumAttempts: 1 },
});

// The cheap DB activities have nothing to protect and can retry normally.
const { resolveIdentitySubject: resolveSubjectRetryable } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export interface VerifyPanWorkflowInput {
  sealedPan: string;
  subject: IdentitySubject;
  callerUserId: string;
  callerRole: "owner" | "tenant";
}

/**
 * PAN verification, ordered cheapest-gate-first:
 *
 *   1. format + holder-type check   — free, in-process
 *   2. cached verified result       — one indexed SELECT
 *   3. per-subject cooldown & cap   — two indexed counts (inside the guard)
 *   4. the paid call                — only if all three let it through
 *
 * Steps 1 and 2 are where the money is actually saved; step 3 exists for the
 * case where a bug defeats the first two.
 */
export async function verifyPanWorkflow(input: VerifyPanWorkflowInput) {
  const subject = await resolveSubjectRetryable({
    subject: input.subject,
    callerUserId: input.callerUserId,
    callerRole: input.callerRole,
  });

  const check = await validateIdentityNumber({ kind: "pan", sealedNumber: input.sealedPan });
  if (!check.valid) {
    // Rejected before anything is spent or written. A malformed PAN cannot
    // exist upstream, so there is no answer worth buying.
    throw ApplicationFailure.create({ type: "invalid_pan", nonRetryable: true });
  }

  const cached = await findCachedIdentityVerification({
    kind: "pan",
    numberFingerprint: check.numberFingerprint,
    tenantId: subject.tenantId,
    tenantUserId: subject.tenantUserId,
  });
  if (cached) return { ...cached, cached: true };

  const outcome = await callPanVerification({ sealedPan: input.sealedPan, subject });

  const base = {
    kind: "pan" as const,
    tenantId: subject.tenantId,
    tenantUserId: subject.tenantUserId,
    ownerId: subject.ownerId,
    numberMasked: check.masked,
    numberFingerprint: check.numberFingerprint,
    expectedName: subject.expectedName,
  };

  if (outcome.kind === "not_configured") {
    const row = await persistIdentityVerification({
      ...base,
      status: "not_configured",
      provider: null,
      providerRef: null,
      verifiedName: null,
      nameMatchScore: null,
      details: null,
      errorMessage: "No identity KYC provider is configured for this deployment.",
    });
    return { ...row, cached: false };
  }

  if (outcome.kind === "provider_error") {
    const row = await persistIdentityVerification({
      ...base,
      status: "failed",
      provider: null,
      providerRef: null,
      verifiedName: null,
      nameMatchScore: null,
      details: { errorKind: outcome.errorKind },
      errorMessage: outcome.message,
    });
    return { ...row, cached: false };
  }

  const { result } = outcome;
  if (!result.found || !result.registeredName) {
    const row = await persistIdentityVerification({
      ...base,
      status: "not_found",
      provider: "identity",
      providerRef: result.providerRef,
      verifiedName: null,
      nameMatchScore: null,
      details: result.details,
      errorMessage: "No PAN record matched this number.",
    });
    return { ...row, cached: false };
  }

  const match = await scoreNameMatch({ expected: subject.expectedName, actual: result.registeredName });

  const row = await persistIdentityVerification({
    ...base,
    status: match.matched ? "verified" : "name_mismatch",
    provider: "identity",
    providerRef: result.providerRef,
    verifiedName: result.registeredName,
    nameMatchScore: match.score,
    details: result.details,
    errorMessage: match.matched ? null : "The PAN is real, but the registered name doesn't match our record.",
  });
  return { ...row, cached: false };
}

export interface SendAadhaarOtpWorkflowInput {
  sealedAadhaar: string;
  subject: IdentitySubject;
  callerUserId: string;
  callerRole: "owner" | "tenant";
}

/**
 * Sends the UIDAI OTP — or, preferably, doesn't.
 *
 * Two free exits come first: an Aadhaar already verified inside its freshness
 * window needs no new session at all, and a live session that has not expired
 * is handed back rather than re-bought. Between them they absorb the common
 * "the SMS hasn't arrived, press it again" behaviour, which is otherwise the
 * single most expensive user habit in this flow.
 */
export async function sendAadhaarOtpWorkflow(input: SendAadhaarOtpWorkflowInput) {
  const subject = await resolveSubjectRetryable({
    subject: input.subject,
    callerUserId: input.callerUserId,
    callerRole: input.callerRole,
  });

  const check = await validateIdentityNumber({ kind: "aadhaar", sealedNumber: input.sealedAadhaar });
  if (!check.valid) {
    // Verhoeff caught it: a mistyped digit, free to reject.
    throw ApplicationFailure.create({ type: "invalid_aadhaar", nonRetryable: true });
  }

  const cached = await findCachedIdentityVerification({
    kind: "aadhaar",
    numberFingerprint: check.numberFingerprint,
    tenantId: subject.tenantId,
    tenantUserId: subject.tenantUserId,
  });
  if (cached) {
    return { alreadyVerified: true, reused: false, sessionId: null, numberMasked: cached.numberMasked, expiresAt: null };
  }

  const live = await findLiveAadhaarOtpSession({
    numberFingerprint: check.numberFingerprint,
    tenantId: subject.tenantId,
    tenantUserId: subject.tenantUserId,
  });
  if (live) {
    return {
      alreadyVerified: false,
      reused: true,
      sessionId: live.id,
      numberMasked: live.numberMasked,
      expiresAt: live.expiresAt,
    };
  }

  const outcome = await callAadhaarOtp({ sealedAadhaar: input.sealedAadhaar, subject });
  if (outcome.kind === "not_configured") {
    throw ApplicationFailure.create({ type: "identity_not_configured", nonRetryable: true });
  }
  if (outcome.kind === "provider_error") {
    throw ApplicationFailure.create({
      message: outcome.message,
      type: "provider_unavailable",
      nonRetryable: true,
    });
  }

  return {
    alreadyVerified: false,
    reused: false,
    sessionId: outcome.session.id,
    numberMasked: outcome.session.numberMasked,
    expiresAt: outcome.session.expiresAt,
  };
}

export interface VerifyAadhaarOtpWorkflowInput {
  sessionId: string;
  sealedOtp: string;
  subject: IdentitySubject;
  callerUserId: string;
  callerRole: "owner" | "tenant";
}

export async function verifyAadhaarOtpWorkflow(input: VerifyAadhaarOtpWorkflowInput) {
  const subject = await resolveSubjectRetryable({
    subject: input.subject,
    callerUserId: input.callerUserId,
    callerRole: input.callerRole,
  });

  // Spends an attempt against the session before the provider is called, and
  // fails closed if the session isn't the caller's, has expired, or is out of
  // attempts.
  const session = await claimAadhaarOtpAttempt({
    sessionId: input.sessionId,
    tenantId: subject.tenantId,
    tenantUserId: subject.tenantUserId,
  });

  const outcome = await callAadhaarOtpVerify({
    sessionId: session.id,
    providerClientId: session.providerClientId,
    sealedOtp: input.sealedOtp,
    ownerId: subject.ownerId,
    numberFingerprint: session.numberFingerprint,
  });

  const base = {
    kind: "aadhaar" as const,
    tenantId: subject.tenantId,
    tenantUserId: subject.tenantUserId,
    ownerId: subject.ownerId,
    numberMasked: session.numberMasked,
    numberFingerprint: session.numberFingerprint,
    expectedName: subject.expectedName,
  };

  if (outcome.kind === "not_configured") {
    throw ApplicationFailure.create({ type: "identity_not_configured", nonRetryable: true });
  }

  if (outcome.kind === "provider_error") {
    // A wrong OTP lands here. The session survives (minus one attempt) so the
    // user can retype without buying a new OTP.
    throw ApplicationFailure.create({
      message: outcome.message,
      type: "otp_verification_failed",
      nonRetryable: true,
    });
  }

  const { result } = outcome;
  const match = await scoreNameMatch({ expected: subject.expectedName, actual: result.registeredName ?? "" });

  return persistIdentityVerification({
    ...base,
    numberMasked: result.maskedNumber ?? session.numberMasked,
    status: match.matched ? "verified" : "name_mismatch",
    provider: "identity",
    providerRef: result.providerRef,
    verifiedName: result.registeredName,
    nameMatchScore: match.score,
    details: result.details,
    errorMessage: match.matched
      ? null
      : "Aadhaar OTP succeeded, but the name on the Aadhaar record doesn't match our record.",
  });
}

export const listIdentityVerificationsForTenantWorkflow = (
  input: Parameters<typeof listIdentityVerificationsForTenant>[0],
) => listIdentityVerificationsForTenant(input);

export const listIdentityVerificationsForTenantUserWorkflow = (
  input: Parameters<typeof listIdentityVerificationsForTenantUser>[0],
) => listIdentityVerificationsForTenantUser(input);
