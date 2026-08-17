import { and, desc, eq, gt, isNull, or, sql } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";
import { providerEnv } from "../../lib/providers/env.js";
import { guardedCall } from "../../lib/providers/costGuard.js";
import { fingerprint } from "../../lib/providers/fingerprint.js";
import { open } from "../../lib/providers/sealed.js";
import { ProviderError } from "../../lib/providers/http.js";
import { getIdentityProvider } from "../../lib/identity/index.js";
import {
  NAME_MATCH_THRESHOLD,
  isValidAadhaar,
  isValidPan,
  maskAadhaar,
  maskPan,
  nameMatchScore,
  normalizeDocumentNumber,
} from "../../lib/identity/validate.js";

export type IdentitySubject = { tenantId: string; tenantUserId?: never } | { tenantUserId: string; tenantId?: never };

export interface ResolvedSubject {
  tenantId: string | null;
  tenantUserId: string | null;
  ownerId: string | null;
  // The name the provider's answer is compared against.
  expectedName: string;
}

const MAX_OTP_ATTEMPTS = 3;

// Resolves who is being verified and — the part that matters — which name
// counts as the truth to match against.
//
// For an owner-initiated check the landlord's own tenants.full_name is the
// reference, which is the whole point of the feature: it answers "is the
// person I wrote down the person who holds this PAN". For a tenant verifying
// themselves we prefer the landlord's record too whenever the account is
// already linked to one (tenants.tenant_user_id), and fall back to the
// tenant's self-entered profile name only when no landlord record exists yet.
// Matching a self-entered name against a self-entered number would verify
// nothing.
export async function resolveIdentitySubject(input: {
  subject: IdentitySubject;
  callerUserId: string;
  callerRole: "owner" | "tenant";
}): Promise<ResolvedSubject> {
  if (input.subject.tenantId) {
    const [tenant] = await db
      .select({ id: schema.tenants.id, ownerId: schema.tenants.ownerId, fullName: schema.tenants.fullName })
      .from(schema.tenants)
      .where(
        and(eq(schema.tenants.id, input.subject.tenantId), eq(schema.tenants.ownerId, input.callerUserId)),
      );
    if (!tenant) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
    return { tenantId: tenant.id, tenantUserId: null, ownerId: tenant.ownerId, expectedName: tenant.fullName };
  }

  const tenantUserId = input.subject.tenantUserId!;
  if (tenantUserId !== input.callerUserId) {
    throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  }

  const [profile] = await db
    .select({ fullName: schema.tenantProfiles.fullName })
    .from(schema.tenantProfiles)
    .where(eq(schema.tenantProfiles.userId, tenantUserId));
  if (!profile) throw ApplicationFailure.create({ type: "no_tenant_profile", nonRetryable: true });

  // Most recent landlord record linked to this account, if any.
  const [linked] = await db
    .select({ ownerId: schema.tenants.ownerId, fullName: schema.tenants.fullName })
    .from(schema.tenants)
    .where(eq(schema.tenants.tenantUserId, tenantUserId))
    .orderBy(desc(schema.tenants.createdAt))
    .limit(1);

  return {
    tenantId: null,
    tenantUserId,
    ownerId: linked?.ownerId ?? null,
    expectedName: linked?.fullName ?? profile.fullName,
  };
}

// --- Cache -----------------------------------------------------------------

// The cheapest possible outcome: a verification we already paid for, on the
// same number, still inside its freshness window. Scoped to the same subject
// as well as the same number so one tenant's verified PAN can never satisfy a
// lookup attributed to a different person — the cache saves money, it does not
// transfer trust between records.
export async function findCachedIdentityVerification(input: {
  kind: "pan" | "aadhaar";
  numberFingerprint: string;
  tenantId: string | null;
  tenantUserId: string | null;
}) {
  const maxAgeDays = input.kind === "pan" ? providerEnv.panCacheDays : providerEnv.aadhaarCacheDays;
  const freshAfter = new Date(Date.now() - maxAgeDays * 24 * 60 * 60 * 1000);

  const [row] = await db
    .select()
    .from(schema.identityVerifications)
    .where(
      and(
        eq(schema.identityVerifications.kind, input.kind),
        eq(schema.identityVerifications.numberFingerprint, input.numberFingerprint),
        eq(schema.identityVerifications.status, "verified"),
        gt(schema.identityVerifications.verifiedAt, freshAfter),
        input.tenantId
          ? eq(schema.identityVerifications.tenantId, input.tenantId)
          : eq(schema.identityVerifications.tenantUserId, input.tenantUserId!),
      ),
    )
    .orderBy(desc(schema.identityVerifications.verifiedAt))
    .limit(1);

  return row ?? null;
}

type PersistInput = {
  kind: "pan" | "aadhaar";
  tenantId: string | null;
  tenantUserId: string | null;
  ownerId: string | null;
  numberMasked: string;
  numberFingerprint: string;
  status: "verified" | "name_mismatch" | "not_found" | "failed" | "not_configured";
  provider: string | null;
  providerRef: string | null;
  verifiedName: string | null;
  expectedName: string | null;
  nameMatchScore: number | null;
  details: Record<string, unknown> | null;
  errorMessage: string | null;
};

export async function persistIdentityVerification(input: PersistInput) {
  const [row] = await db
    .insert(schema.identityVerifications)
    .values({
      ...input,
      nameMatchScore: input.nameMatchScore === null ? null : String(input.nameMatchScore),
      verifiedAt: input.status === "verified" ? new Date() : null,
    })
    .returning();

  // A verified government-source check is strong enough to move the coarse
  // KYC flag on its own — same promotion rule the document pipeline uses in
  // activities/kyc.ts, and the only other automated path allowed to set it.
  if (input.status === "verified") {
    if (input.tenantId) {
      await db.update(schema.tenants).set({ kycStatus: "verified" }).where(eq(schema.tenants.id, input.tenantId));
    }
    if (input.tenantUserId) {
      await db
        .update(schema.tenantProfiles)
        .set({ kycStatus: "verified" })
        .where(eq(schema.tenantProfiles.userId, input.tenantUserId));
    }
  }

  return row;
}

// --- PAN -------------------------------------------------------------------

export interface VerifyPanActivityInput {
  sealedPan: string;
  subject: ResolvedSubject;
}

// One billable call, wrapped in the cost guard. Everything free — format
// check, checksum, cache probe — has already happened in the workflow before
// this activity is reached.
export async function callPanVerification(input: VerifyPanActivityInput) {
  const provider = getIdentityProvider();
  if (!provider) {
    return { kind: "not_configured" as const };
  }

  const panNumber = normalizeDocumentNumber(open(input.sealedPan));
  const fp = fingerprint(panNumber);

  try {
    const result = await guardedCall({
      provider: provider.name,
      family: "identity",
      operation: "identity.pan",
      subjectFingerprint: fp,
      ownerId: input.subject.ownerId,
      cooldownSeconds: providerEnv.identityCooldownSeconds,
      // Same key for every retry of this one logical lookup, so a retry after
      // a timeout re-reads the first attempt rather than buying a second.
      run: () => provider.verifyPan({ panNumber, idempotencyKey: `pan:${fp}` }),
    });
    return { kind: "answered" as const, result };
  } catch (err) {
    if (err instanceof ProviderError) {
      return { kind: "provider_error" as const, message: err.message, errorKind: err.kind };
    }
    throw err;
  }
}

// --- Aadhaar OTP -----------------------------------------------------------

// Duplicate-request suppression, and the single biggest saving in the Aadhaar
// flow. A tenant who does not see the SMS will press "send" again; without
// this, every press is another billed OTP and another code that invalidates
// the one they are about to type. A live session is handed straight back.
export async function findLiveAadhaarOtpSession(input: {
  numberFingerprint: string;
  tenantId: string | null;
  tenantUserId: string | null;
}) {
  const [row] = await db
    .select()
    .from(schema.aadhaarOtpSessions)
    .where(
      and(
        eq(schema.aadhaarOtpSessions.numberFingerprint, input.numberFingerprint),
        eq(schema.aadhaarOtpSessions.status, "otp_sent"),
        gt(schema.aadhaarOtpSessions.expiresAt, new Date()),
        isNull(schema.aadhaarOtpSessions.consumedAt),
        input.tenantId
          ? eq(schema.aadhaarOtpSessions.tenantId, input.tenantId)
          : eq(schema.aadhaarOtpSessions.tenantUserId, input.tenantUserId!),
      ),
    )
    .orderBy(desc(schema.aadhaarOtpSessions.createdAt))
    .limit(1);

  return row ?? null;
}

export interface SendAadhaarOtpActivityInput {
  sealedAadhaar: string;
  subject: ResolvedSubject;
}

export async function callAadhaarOtp(input: SendAadhaarOtpActivityInput) {
  const provider = getIdentityProvider();
  if (!provider) return { kind: "not_configured" as const };

  const aadhaarNumber = open(input.sealedAadhaar).replace(/\D/g, "");
  const fp = fingerprint(aadhaarNumber);

  try {
    const init = await guardedCall({
      provider: provider.name,
      family: "identity",
      operation: "identity.aadhaar_otp",
      subjectFingerprint: fp,
      ownerId: input.subject.ownerId,
      cooldownSeconds: providerEnv.identityCooldownSeconds,
      run: () => provider.sendAadhaarOtp({ aadhaarNumber, idempotencyKey: `aadhaar-otp:${fp}:${Date.now()}` }),
    });

    const [row] = await db
      .insert(schema.aadhaarOtpSessions)
      .values({
        tenantId: input.subject.tenantId,
        tenantUserId: input.subject.tenantUserId,
        ownerId: input.subject.ownerId,
        numberMasked: maskAadhaar(aadhaarNumber),
        numberFingerprint: fp,
        provider: provider.name,
        providerClientId: init.clientId,
        expiresAt: new Date(Date.now() + providerEnv.aadhaarOtpTtlSeconds * 1000),
      })
      .returning();

    return { kind: "sent" as const, session: row! };
  } catch (err) {
    if (err instanceof ProviderError) {
      return { kind: "provider_error" as const, message: err.message, errorKind: err.kind };
    }
    throw err;
  }
}

// Loads the session and charges an attempt against it in the same call, before
// the provider is contacted. Doing it in this order is deliberate: if the
// process dies mid-submit, the attempt is still spent, which is the safe
// direction — the alternative lets a crash loop submit unlimited guesses at a
// per-call price.
export async function claimAadhaarOtpAttempt(input: {
  sessionId: string;
  tenantId: string | null;
  tenantUserId: string | null;
}) {
  const [session] = await db
    .update(schema.aadhaarOtpSessions)
    .set({ attempts: sql`${schema.aadhaarOtpSessions.attempts} + 1` })
    .where(
      and(
        eq(schema.aadhaarOtpSessions.id, input.sessionId),
        eq(schema.aadhaarOtpSessions.status, "otp_sent"),
        isNull(schema.aadhaarOtpSessions.consumedAt),
        gt(schema.aadhaarOtpSessions.expiresAt, new Date()),
        sql`${schema.aadhaarOtpSessions.attempts} < ${MAX_OTP_ATTEMPTS}`,
        input.tenantId
          ? eq(schema.aadhaarOtpSessions.tenantId, input.tenantId)
          : eq(schema.aadhaarOtpSessions.tenantUserId, input.tenantUserId!),
      ),
    )
    .returning();

  if (!session) {
    // Covers every way a session can be unusable — wrong owner, expired,
    // already consumed, attempts exhausted — with one response, so the caller
    // learns nothing about sessions that are not theirs.
    throw ApplicationFailure.create({ type: "otp_session_unusable", nonRetryable: true });
  }
  return session;
}

export async function callAadhaarOtpVerify(input: {
  sessionId: string;
  providerClientId: string;
  sealedOtp: string;
  ownerId: string | null;
  numberFingerprint: string;
}) {
  const provider = getIdentityProvider();
  if (!provider) return { kind: "not_configured" as const };

  try {
    const result = await guardedCall({
      provider: provider.name,
      family: "identity",
      operation: "identity.aadhaar_verify",
      subjectFingerprint: input.numberFingerprint,
      ownerId: input.ownerId,
      // No cooldown: a wrong OTP is a legitimate immediate retry by the user,
      // and MAX_OTP_ATTEMPTS on the session is what bounds it instead.
      cooldownSeconds: 0,
      run: () => provider.submitAadhaarOtp({ clientId: input.providerClientId, otp: open(input.sealedOtp) }),
    });

    await db
      .update(schema.aadhaarOtpSessions)
      .set({ status: "consumed", consumedAt: new Date() })
      .where(eq(schema.aadhaarOtpSessions.id, input.sessionId));

    return { kind: "answered" as const, result };
  } catch (err) {
    if (err instanceof ProviderError) {
      return { kind: "provider_error" as const, message: err.message, errorKind: err.kind };
    }
    throw err;
  }
}

// --- Shared scoring --------------------------------------------------------

// Pure, but an activity rather than workflow code: nameMatchScore walks a
// Levenshtein matrix, and workflow code in Temporal is replayed on every
// worker restart. Cheap work still does not belong on the replay path.
export async function scoreNameMatch(input: { expected: string; actual: string }) {
  const score = nameMatchScore(input.expected, input.actual);
  return { score, matched: score >= NAME_MATCH_THRESHOLD };
}

// --- Reads -----------------------------------------------------------------

export async function listIdentityVerificationsForTenantUser(input: { tenantUserId: string }) {
  return db
    .select()
    .from(schema.identityVerifications)
    .where(eq(schema.identityVerifications.tenantUserId, input.tenantUserId))
    .orderBy(desc(schema.identityVerifications.createdAt));
}

export async function listIdentityVerificationsForTenant(input: { tenantId: string; ownerId: string }) {
  const [tenant] = await db
    .select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(and(eq(schema.tenants.id, input.tenantId), eq(schema.tenants.ownerId, input.ownerId)));
  if (!tenant) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });

  return db
    .select()
    .from(schema.identityVerifications)
    .where(
      // An owner sees checks they commissioned on their own tenant record, and
      // checks the linked tenant-user ran on themselves and thereby shared —
      // never a verification belonging to some other landlord's record.
      or(
        eq(schema.identityVerifications.tenantId, input.tenantId),
        and(
          eq(schema.identityVerifications.ownerId, input.ownerId),
          eq(schema.identityVerifications.tenantId, input.tenantId),
        ),
      ),
    )
    .orderBy(desc(schema.identityVerifications.createdAt));
}

// Free, server-side format validation, exposed so the workflow can reject
// before spending anything. Duplicated on the client for immediate feedback;
// this copy is the one that actually gates the call.
export async function validateIdentityNumber(input: { kind: "pan" | "aadhaar"; sealedNumber: string }) {
  const raw = open(input.sealedNumber);
  if (input.kind === "pan") {
    const value = normalizeDocumentNumber(raw);
    return { valid: isValidPan(value), masked: maskPan(value), numberFingerprint: isValidPan(value) ? fingerprint(value) : "" };
  }
  const digits = raw.replace(/\D/g, "");
  return {
    valid: isValidAadhaar(digits),
    masked: maskAadhaar(digits),
    numberFingerprint: isValidAadhaar(digits) ? fingerprint(digits) : "",
  };
}
