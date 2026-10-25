import { proxyActivities } from "@temporalio/workflow";
import { ApplicationFailure } from "@temporalio/common";
import type * as activities from "../activities/index.js";
import type { SignerRole } from "../../lib/esign/provider.js";

// Cheap, idempotent, DB/R2-only work. Safe to retry.
const { buildAgreementTerms, getLatestAgreementForLease, loadAgreementForOwner, claimWebhookEvent, markWebhookEventProcessed, findAgreementForEvent, recordSignerSigned, setAgreementStatus } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: "20 seconds",
    retry: { maximumAttempts: 3 },
  });

// PDF rendering plus an R2 write. Retryable — a retry costs CPU and produces a
// second orphaned object at worst, never a second billable transaction.
const { createAgreementDraft } = proxyActivities<typeof activities>({
  startToCloseTimeout: "60 seconds",
  retry: { maximumAttempts: 2 },
});

// Billable provider calls: single attempt, for the same reason as the identity
// workflows — Temporal's retry cannot tell a free failure from a paid one.
const { sendAgreementForSignature, refreshSignerUrl, storeSignedDocument } = proxyActivities<typeof activities>({
  startToCloseTimeout: "90 seconds",
  retry: { maximumAttempts: 1 },
});

// Mail goes through the shared gateway and is already best-effort inside
// sendMail, so a couple of attempts is right: worth retrying, never worth
// failing the workflow over.
const { notifySigner, notifyAgreementCompleted } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: { maximumAttempts: 2 },
});

export const getLeaseAgreementWorkflow = (input: Parameters<typeof getLatestAgreementForLease>[0]) =>
  getLatestAgreementForLease(input);

/**
 * Generates the agreement PDF and files it as a draft. Free — nothing external
 * is called. Splitting this from "send for signature" is deliberate: the
 * landlord reads the draft before a paying transaction is created, and a
 * deployment with no e-Sign vendor configured still gets a usable document it
 * can print and sign on paper.
 */
export async function createLeaseAgreementWorkflow(input: { leaseId: string; ownerId: string }) {
  const terms = await buildAgreementTerms(input);
  return createAgreementDraft({ leaseId: input.leaseId, ownerId: input.ownerId, terms });
}

/** Creates the e-Sign transaction and invites the landlord (signer 1 of 2). */
export async function sendLeaseAgreementWorkflow(input: { agreementId: string; ownerId: string }) {
  const outcome = await sendAgreementForSignature(input);

  if (outcome.kind === "not_configured") {
    throw ApplicationFailure.create({ type: "esign_not_configured", nonRetryable: true });
  }
  if (outcome.kind === "provider_error") {
    throw ApplicationFailure.create({ message: outcome.message, type: "provider_unavailable", nonRetryable: true });
  }

  // Best-effort: the transaction exists and is billed whether or not our own
  // reminder mail lands, so a mail failure must not fail the workflow. The
  // provider mails the invitee as well.
  await notifySigner({ agreementId: input.agreementId, role: "landlord" });

  const { agreement, signers } = await loadAgreementForOwner(input);
  return { agreement, signers, signUrl: outcome.signUrl };
}

export async function refreshSignUrlWorkflow(input: {
  agreementId: string;
  role: SignerRole;
  requesterUserId: string;
}) {
  const outcome = await refreshSignerUrl({ ...input, ownerId: null });
  if (outcome.kind === "not_configured") {
    throw ApplicationFailure.create({ type: "esign_not_configured", nonRetryable: true });
  }
  return { signUrl: outcome.signUrl, expiresAt: outcome.expiresAt };
}

export interface EsignWebhookWorkflowInput {
  provider: string;
  eventId: string;
  eventType: string;
  referenceId: string | null;
  providerRef: string | null;
  signerRole: SignerRole | null;
  signedAt: string | null;
  payload: Record<string, unknown>;
}

/**
 * Handles one verified webhook delivery.
 *
 * Started detached from the HTTP request (the route acks immediately), because
 * a provider that does not get a fast 2xx retries — and a retry storm against
 * a slow handler is how one signature event turns into a dozen duplicate
 * downloads. Everything after the ack is idempotent, gated on the
 * esign_webhook_events unique constraint.
 */
export async function handleEsignWebhookWorkflow(input: EsignWebhookWorkflowInput) {
  const agreement = await findAgreementForEvent({
    referenceId: input.referenceId,
    providerRef: input.providerRef,
  });

  const claim = await claimWebhookEvent({
    provider: input.provider,
    eventId: input.eventId,
    eventType: input.eventType,
    agreementId: agreement?.id ?? null,
    payload: input.payload,
  });

  // Seen before. Recorded, acked, nothing else to do.
  if (!claim.claimed) return { handled: false, reason: "duplicate" as const };
  // Stored for forensics even when it matches nothing of ours — a callback for
  // an unknown document is worth being able to look at later.
  if (!agreement) return { handled: false, reason: "unknown_agreement" as const };

  switch (input.eventType) {
    case "signed": {
      if (input.signerRole) {
        await recordSignerSigned({
          agreementId: agreement.id,
          role: input.signerRole,
          signedAt: input.signedAt,
        });
        // The provider releases the next invitation itself once the previous
        // signer completes; our mail is a nudge on top of it, aimed at the
        // address we hold rather than the one they hold.
        if (input.signerRole === "landlord") {
          await notifySigner({ agreementId: agreement.id, role: "tenant" });
        }
      }
      break;
    }
    case "completed": {
      await storeSignedDocument({ agreementId: agreement.id });
      await notifyAgreementCompleted({ agreementId: agreement.id });
      break;
    }
    case "declined":
    case "expired": {
      await setAgreementStatus({
        agreementId: agreement.id,
        status: input.eventType === "declined" ? "declined" : "expired",
        message: `Signing ${input.eventType} at the provider.`,
      });
      break;
    }
    default:
      break;
  }

  await markWebhookEventProcessed({ eventRowId: claim.eventRowId! });
  return { handled: true, reason: null };
}
