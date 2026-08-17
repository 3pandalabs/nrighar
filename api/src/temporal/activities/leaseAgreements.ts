import { randomUUID } from "node:crypto";
import { and, desc, eq, inArray } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";
import { env } from "../../env.js";
import { getObject, presignDownload, putObject } from "../../plugins/r2.js";
import { guardedCall } from "../../lib/providers/costGuard.js";
import { providerEnv } from "../../lib/providers/env.js";
import { ProviderError } from "../../lib/providers/http.js";
import { getESignProvider, renderAgreementPdf, type AgreementTerms, type SignerRole } from "../../lib/esign/index.js";
import { sendMail } from "../../lib/mailer.js";
import { buildAgreementCompletedEmail, buildSignatureRequestEmail } from "../../lib/emails/leaseAgreement.js";

const AGREEMENT_EXPIRY_DAYS = 14;

// --- Draft generation ------------------------------------------------------

// Gathers everything the agreement says, from the rows that already hold it.
// The result is frozen into lease_agreements.terms: the lease row stays
// editable afterwards, but a signed document must keep saying what was signed,
// so nothing downstream re-reads these tables.
export async function buildAgreementTerms(input: { leaseId: string; ownerId: string }): Promise<AgreementTerms> {
  const [row] = await db
    .select({
      lease: schema.leases,
      property: schema.properties,
      tenant: schema.tenants,
      ownerProfile: schema.profiles,
      ownerUser: schema.users,
    })
    .from(schema.leases)
    .innerJoin(schema.properties, eq(schema.properties.id, schema.leases.propertyId))
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.leases.tenantId))
    .innerJoin(schema.users, eq(schema.users.id, schema.leases.ownerId))
    .leftJoin(schema.profiles, eq(schema.profiles.id, schema.leases.ownerId))
    .where(and(eq(schema.leases.id, input.leaseId), eq(schema.leases.ownerId, input.ownerId)));

  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });

  return {
    landlord: {
      name: row.ownerProfile?.displayName ?? row.ownerUser.email,
      email: row.ownerUser.email,
      countryOfResidence: row.ownerProfile?.countryOfResidence ?? null,
    },
    tenant: { name: row.tenant.fullName, email: row.tenant.email, phone: row.tenant.phone },
    property: {
      nickname: row.property.nickname,
      addressLine1: row.property.addressLine1,
      addressLine2: row.property.addressLine2,
      city: row.property.city,
      state: row.property.state,
      pincode: row.property.pincode,
      propertyType: row.property.propertyType,
      bedrooms: row.property.bedrooms,
    },
    lease: {
      rentAmount: row.lease.rentAmount,
      depositAmount: row.lease.depositAmount,
      startDate: row.lease.startDate,
      endDate: row.lease.endDate,
      rentDueDay: row.lease.rentDueDay,
    },
    generatedOn: new Date().toISOString().slice(0, 10),
  };
}

// Renders and stores the unsigned PDF, then writes the agreement + its two
// signer rows.
//
// The object goes under the owner's own `<userId>/` R2 prefix, so every
// existing storage authz check (plugins/r2.ts keyOwnerUserId, routes/storage.ts)
// applies to it unchanged — no new bucket, no new access rule, nothing public.
export async function createAgreementDraft(input: { leaseId: string; ownerId: string; terms: AgreementTerms }) {
  const { buffer, sha256 } = await renderAgreementPdf(input.terms);
  const storagePath = `${input.ownerId}/agreements/${input.leaseId}/${randomUUID()}-unsigned.pdf`;
  await putObject(storagePath, buffer, "application/pdf");

  const [agreement] = await db
    .insert(schema.leaseAgreements)
    .values({
      leaseId: input.leaseId,
      ownerId: input.ownerId,
      status: "draft",
      unsignedStoragePath: storagePath,
      contentHash: sha256,
      terms: input.terms,
    })
    .returning();

  await db.insert(schema.leaseAgreementSigners).values([
    {
      agreementId: agreement!.id,
      role: "landlord",
      signOrder: 1,
      fullName: input.terms.landlord.name,
      email: input.terms.landlord.email,
    },
    {
      agreementId: agreement!.id,
      role: "tenant",
      signOrder: 2,
      fullName: input.terms.tenant.name,
      email: input.terms.tenant.email,
      phone: input.terms.tenant.phone,
    },
  ]);

  return agreement!;
}

// --- Sending for signature -------------------------------------------------

export async function loadAgreementForOwner(input: { agreementId: string; ownerId: string }) {
  const [agreement] = await db
    .select()
    .from(schema.leaseAgreements)
    .where(and(eq(schema.leaseAgreements.id, input.agreementId), eq(schema.leaseAgreements.ownerId, input.ownerId)));
  if (!agreement) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });

  const signers = await db
    .select()
    .from(schema.leaseAgreementSigners)
    .where(eq(schema.leaseAgreementSigners.agreementId, agreement.id))
    .orderBy(schema.leaseAgreementSigners.signOrder);

  return { agreement, signers };
}

export async function getLatestAgreementForLease(input: { leaseId: string; ownerId: string }) {
  const [agreement] = await db
    .select()
    .from(schema.leaseAgreements)
    .where(and(eq(schema.leaseAgreements.leaseId, input.leaseId), eq(schema.leaseAgreements.ownerId, input.ownerId)))
    .orderBy(desc(schema.leaseAgreements.createdAt))
    .limit(1);
  if (!agreement) return null;

  const signers = await db
    .select()
    .from(schema.leaseAgreementSigners)
    .where(eq(schema.leaseAgreementSigners.agreementId, agreement.id))
    .orderBy(schema.leaseAgreementSigners.signOrder);

  // Whichever copy exists is the one worth handing back: the signed PDF once
  // there is one, the draft until then. Presigned and short-lived, like every
  // other document read in this app.
  const path = agreement.signedStoragePath ?? agreement.unsignedStoragePath;
  return { agreement, signers, downloadUrl: await presignDownload(path) };
}

// The paid call. Everything before it — rendering, storing, writing rows — is
// free and already done, so a failure here leaves a draft that can be re-sent
// rather than losing the document.
export async function sendAgreementForSignature(input: { agreementId: string; ownerId: string }) {
  const provider = getESignProvider();
  if (!provider) return { kind: "not_configured" as const };

  const { agreement, signers } = await loadAgreementForOwner(input);
  if (agreement.status !== "draft") {
    // Already out for signature. Re-sending would create a second billable
    // transaction against the same lease, and the partial unique index would
    // then be the only thing preventing two live agreements.
    throw ApplicationFailure.create({ type: "conflict", nonRetryable: true });
  }
  if (!providerEnv.esignWebhookUrl) {
    throw ApplicationFailure.create({
      message: "ESIGN_WEBHOOK_URL is not set, so completion callbacks would be lost",
      type: "esign_not_configured",
      nonRetryable: true,
    });
  }

  const { buffer } = await getObject(agreement.unsignedStoragePath);

  try {
    const transaction = await guardedCall({
      provider: provider.name,
      family: "esign",
      operation: "esign.create",
      ownerId: input.ownerId,
      // No per-subject cooldown: two agreements for the same lease within a
      // minute is unusual but legitimate (a corrected draft), and the
      // draft-status check above already stops the accidental double-send.
      cooldownSeconds: 0,
      run: () =>
        provider.createTransaction({
          documentBase64: buffer.toString("base64"),
          fileName: `rental-agreement-${agreement.leaseId}.pdf`,
          referenceId: agreement.id,
          webhookUrl: providerEnv.esignWebhookUrl,
          expiresInDays: AGREEMENT_EXPIRY_DAYS,
          signers: signers.map((s) => ({
            role: s.role as SignerRole,
            order: s.signOrder,
            name: s.fullName,
            email: s.email,
            phone: s.phone,
          })),
        }),
    });

    await db
      .update(schema.leaseAgreements)
      .set({
        status: "sent",
        provider: provider.name,
        providerRef: transaction.providerRef,
        sentAt: new Date(),
        errorMessage: null,
      })
      .where(eq(schema.leaseAgreements.id, agreement.id));

    for (const invitation of transaction.invitations) {
      await db
        .update(schema.leaseAgreementSigners)
        .set({
          signUrl: invitation.signUrl,
          signUrlExpiresAt: invitation.expiresAt,
          // Only the first signer is actually invited now — the provider holds
          // the rest until the sequence reaches them.
          status: invitation.role === "landlord" ? "notified" : "pending",
          notifiedAt: invitation.role === "landlord" ? new Date() : null,
        })
        .where(
          and(
            eq(schema.leaseAgreementSigners.agreementId, agreement.id),
            eq(schema.leaseAgreementSigners.role, invitation.role),
          ),
        );
    }

    const landlordInvitation = transaction.invitations.find((i) => i.role === "landlord");
    return {
      kind: "sent" as const,
      providerRef: transaction.providerRef,
      signUrl: landlordInvitation?.signUrl ?? null,
    };
  } catch (err) {
    const message = err instanceof ProviderError ? err.message : String(err);
    await db
      .update(schema.leaseAgreements)
      .set({ errorMessage: message })
      .where(eq(schema.leaseAgreements.id, agreement.id));
    if (err instanceof ProviderError) return { kind: "provider_error" as const, message };
    throw err;
  }
}

// Providers expire signing links, so the link is fetched on demand rather than
// stored and trusted. Cheap at every vendor we integrate with (a document read,
// not a new transaction), but still ledgered so the volume is visible.
export async function refreshSignerUrl(input: { agreementId: string; role: SignerRole; ownerId: string | null; requesterUserId: string }) {
  const [agreement] = await db
    .select()
    .from(schema.leaseAgreements)
    .where(eq(schema.leaseAgreements.id, input.agreementId));
  if (!agreement || !agreement.providerRef) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });

  // Authz: the landlord link is for the owner, the tenant link is for the
  // linked tenant-user on that lease. Nobody else gets either.
  const allowed = await callerMaySign({
    agreementId: agreement.id,
    leaseId: agreement.leaseId,
    ownerId: agreement.ownerId,
    role: input.role,
    requesterUserId: input.requesterUserId,
  });
  if (!allowed) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });

  const provider = getESignProvider();
  if (!provider) return { kind: "not_configured" as const };

  const invitation = await guardedCall({
    provider: provider.name,
    family: "esign",
    operation: "esign.refresh_url",
    ownerId: agreement.ownerId,
    cooldownSeconds: 0,
    run: () => provider.refreshSignUrl({ providerRef: agreement.providerRef!, role: input.role }),
  });

  await db
    .update(schema.leaseAgreementSigners)
    .set({ signUrl: invitation.signUrl, signUrlExpiresAt: invitation.expiresAt })
    .where(
      and(
        eq(schema.leaseAgreementSigners.agreementId, agreement.id),
        eq(schema.leaseAgreementSigners.role, input.role),
      ),
    );

  return { kind: "ok" as const, signUrl: invitation.signUrl, expiresAt: invitation.expiresAt };
}

async function callerMaySign(input: {
  agreementId: string;
  leaseId: string;
  ownerId: string;
  role: SignerRole;
  requesterUserId: string;
}): Promise<boolean> {
  if (input.role === "landlord") return input.ownerId === input.requesterUserId;

  const [lease] = await db
    .select({ tenantUserId: schema.tenants.tenantUserId })
    .from(schema.leases)
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.leases.tenantId))
    .where(eq(schema.leases.id, input.leaseId));
  return Boolean(lease?.tenantUserId && lease.tenantUserId === input.requesterUserId);
}

// --- Webhook ---------------------------------------------------------------

// The dedupe gate. Providers retry until they get a 2xx and some fan an event
// out more than once; without this, a redelivered "completed" re-downloads the
// signed PDF (a billable read) and re-mails both parties.
//
// The unique constraint IS the lock — insert first, and treat a unique
// violation as "already handled". Doing it as select-then-insert would leave a
// window for two concurrent deliveries to both pass the check.
export async function claimWebhookEvent(input: {
  provider: string;
  eventId: string;
  eventType: string;
  agreementId: string | null;
  payload: Record<string, unknown>;
}) {
  const inserted = await db
    .insert(schema.esignWebhookEvents)
    .values({
      provider: input.provider,
      eventId: input.eventId,
      eventType: input.eventType,
      agreementId: input.agreementId,
      payload: input.payload,
    })
    .onConflictDoNothing({
      target: [schema.esignWebhookEvents.provider, schema.esignWebhookEvents.eventId],
    })
    .returning({ id: schema.esignWebhookEvents.id });

  return { claimed: inserted.length > 0, eventRowId: inserted[0]?.id ?? null };
}

export async function markWebhookEventProcessed(input: { eventRowId: string }) {
  await db
    .update(schema.esignWebhookEvents)
    .set({ processedAt: new Date() })
    .where(eq(schema.esignWebhookEvents.id, input.eventRowId));
}

// Resolves a callback to one of our agreements. Matches on our own reference
// id first — that value round-tripped through the provider and is the only
// field in the payload we chose ourselves — and falls back to the provider's
// document id.
export async function findAgreementForEvent(input: { referenceId: string | null; providerRef: string | null }) {
  if (input.referenceId) {
    const [byRef] = await db
      .select()
      .from(schema.leaseAgreements)
      .where(eq(schema.leaseAgreements.id, input.referenceId));
    if (byRef) return byRef;
  }
  if (input.providerRef) {
    const [byProvider] = await db
      .select()
      .from(schema.leaseAgreements)
      .where(eq(schema.leaseAgreements.providerRef, input.providerRef));
    if (byProvider) return byProvider;
  }
  return null;
}

export async function recordSignerSigned(input: { agreementId: string; role: SignerRole; signedAt: string | null }) {
  await db
    .update(schema.leaseAgreementSigners)
    .set({ status: "signed", signedAt: input.signedAt ? new Date(input.signedAt) : new Date() })
    .where(
      and(
        eq(schema.leaseAgreementSigners.agreementId, input.agreementId),
        eq(schema.leaseAgreementSigners.role, input.role),
      ),
    );

  const signers = await db
    .select()
    .from(schema.leaseAgreementSigners)
    .where(eq(schema.leaseAgreementSigners.agreementId, input.agreementId));

  const allSigned = signers.every((s) => s.status === "signed");

  // Only the intermediate state is set here. `completed` belongs to
  // storeSignedDocument, because an agreement is not complete until the signed
  // PDF is actually in our bucket — marking it complete on the strength of a
  // callback alone would leave a "completed" agreement with no document behind
  // it if the download then failed.
  if (!allSigned) {
    await db
      .update(schema.leaseAgreements)
      .set({ status: "partially_signed" })
      .where(
        and(
          eq(schema.leaseAgreements.id, input.agreementId),
          // Never walk an agreement backwards: a late per-signer event
          // arriving after the completion callback must not reopen it.
          inArray(schema.leaseAgreements.status, ["sent", "partially_signed"]),
        ),
      );
  }

  return { allSigned };
}

export async function setAgreementStatus(input: {
  agreementId: string;
  status: "declined" | "expired" | "failed";
  message: string | null;
}) {
  await db
    .update(schema.leaseAgreements)
    .set({ status: input.status, errorMessage: input.message })
    .where(
      and(
        eq(schema.leaseAgreements.id, input.agreementId),
        inArray(schema.leaseAgreements.status, ["draft", "sent", "partially_signed"]),
      ),
    );
}

// Pulls the final signed PDF and files it next to the draft. The signed copy
// is what carries the signing certificates and the provider's tamper-evident
// seal, so it is stored rather than linked — a provider-hosted URL is not a
// durable record and this app's whole job is to be the durable record.
export async function storeSignedDocument(input: { agreementId: string }) {
  const [agreement] = await db
    .select()
    .from(schema.leaseAgreements)
    .where(eq(schema.leaseAgreements.id, input.agreementId));
  if (!agreement?.providerRef) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });

  // Already stored — a redelivered completion event gets here despite the
  // dedupe if the provider generated a new event id for it.
  if (agreement.signedStoragePath) {
    return { storagePath: agreement.signedStoragePath, alreadyStored: true };
  }

  const provider = getESignProvider();
  if (!provider) throw ApplicationFailure.create({ type: "esign_not_configured", nonRetryable: true });

  const buffer = await guardedCall({
    provider: provider.name,
    family: "esign",
    operation: "esign.download",
    ownerId: agreement.ownerId,
    cooldownSeconds: 0,
    run: () => provider.downloadSignedDocument({ providerRef: agreement.providerRef! }),
  });

  const storagePath = `${agreement.ownerId}/agreements/${agreement.leaseId}/${agreement.id}-signed.pdf`;
  await putObject(storagePath, buffer, "application/pdf");

  await db
    .update(schema.leaseAgreements)
    .set({ status: "completed", signedStoragePath: storagePath, completedAt: new Date(), errorMessage: null })
    .where(eq(schema.leaseAgreements.id, agreement.id));

  // Surface the signed agreement in the documents list the owner already
  // uses, rather than inventing a second place to look for it.
  await db.insert(schema.documents).values({
    ownerId: agreement.ownerId,
    leaseId: agreement.leaseId,
    docType: "agreement",
    title: "Signed rental agreement",
    storagePath,
  });

  return { storagePath, alreadyStored: false };
}

// --- Notifications ---------------------------------------------------------

export async function notifySigner(input: { agreementId: string; role: SignerRole }) {
  const { agreement, signers } = await loadAgreementByIdInternal(input.agreementId);
  const signer = signers.find((s) => s.role === input.role);
  if (!signer?.email || !signer.signUrl) return { sent: false };

  const counterparty = signers.find((s) => s.role !== input.role);
  const terms = agreement.terms as AgreementTerms;

  const result = await sendMail(
    [
      buildSignatureRequestEmail({
        to: signer.email,
        signerName: signer.fullName,
        counterpartyName: counterparty?.fullName ?? "The other party",
        propertyNickname: terms.property.nickname,
        signUrl: signer.signUrl,
        isFirstSigner: signer.signOrder === 1,
      }),
    ],
    (msg) => console.log(`lease-agreement mail: ${msg}`),
  );

  if (result.delivered > 0) {
    await db
      .update(schema.leaseAgreementSigners)
      .set({ status: "notified", notifiedAt: new Date() })
      .where(eq(schema.leaseAgreementSigners.id, signer.id));
  }
  return { sent: result.delivered > 0 };
}

export async function notifyAgreementCompleted(input: { agreementId: string }) {
  const { agreement, signers } = await loadAgreementByIdInternal(input.agreementId);
  const terms = agreement.terms as AgreementTerms;
  const dashboardUrl = `${env.WEB_ORIGIN.replace(/\/$/, "")}/dashboard/leases/${agreement.leaseId}`;

  const messages = signers
    .filter((s) => s.email)
    .map((s) =>
      buildAgreementCompletedEmail({
        to: s.email!,
        recipientName: s.fullName,
        propertyNickname: terms.property.nickname,
        dashboardUrl,
      }),
    );
  if (!messages.length) return { sent: 0 };

  const result = await sendMail(messages, (msg) => console.log(`lease-agreement mail: ${msg}`));
  return { sent: result.delivered };
}

async function loadAgreementByIdInternal(agreementId: string) {
  const [agreement] = await db
    .select()
    .from(schema.leaseAgreements)
    .where(eq(schema.leaseAgreements.id, agreementId));
  if (!agreement) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  const signers = await db
    .select()
    .from(schema.leaseAgreementSigners)
    .where(eq(schema.leaseAgreementSigners.agreementId, agreementId))
    .orderBy(schema.leaseAgreementSigners.signOrder);
  return { agreement, signers };
}
