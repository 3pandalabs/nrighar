import { createHash, createHmac } from "node:crypto";
import { providerEnv } from "../providers/env.js";
import { ProviderError, providerFetch } from "../providers/http.js";
import { safeEqual } from "../providers/fingerprint.js";
import type {
  CreateTransactionInput,
  ESignEvent,
  ESignProvider,
  ESignTransaction,
  SignerInvitation,
  SignerRole,
} from "./provider.js";

// Leegality adapter.
//
// Same caveat as the SurePass adapter: field names follow Leegality's
// published v3 sign-request API (`POST /sign/request`, `X-Auth-Token` auth,
// invitees with `signatureType` and `sequence`), written without a sandbox
// account to verify against. Confirm each shape — in particular the webhook
// signature header name and digest construction, which vendors change more
// often than they change request bodies — before pointing production at it.
//
// Sequencing: Leegality invites by `sequence`, and only mails the next invitee
// once the previous one signs. That is exactly the landlord-then-tenant order
// this feature needs, so it is delegated to the provider rather than driven
// from our webhook. The webhook still records each `signed` event, so if the
// provider's sequencing were ever wrong the audit trail would show it.

interface LeegalityEnvelope<T> {
  status?: number;
  message?: string;
  data?: T;
}

interface LeegalitySignRequestData {
  documentId?: string;
  irn?: string;
  invitations?: {
    name?: string;
    emailId?: string;
    phone?: string;
    signUrl?: string;
    active?: boolean;
    expiryDate?: string;
  }[];
}

interface LeegalityWebhookPayload {
  eventId?: string;
  event?: string;
  status?: string;
  documentId?: string;
  irn?: string;
  auditTrail?: unknown;
  invitations?: { name?: string; emailId?: string; status?: string; signedOn?: string }[];
}

function url(path: string): string {
  return `${providerEnv.leegalityBaseUrl.replace(/\/$/, "")}${path}`;
}

function authHeaders(): Record<string, string> {
  return { "X-Auth-Token": providerEnv.leegalityAuthToken };
}

// Leegality identifies invitees by name/email, not by our role vocabulary, so
// the mapping back from a callback is by position — which is why `sequence` is
// set explicitly on the way out and never left to the provider's default.
function roleForSequence(sequence: number): SignerRole {
  return sequence === 1 ? "landlord" : "tenant";
}

function parseDate(value: string | undefined): Date | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export class LeegalityESignProvider implements ESignProvider {
  readonly name = "leegality";

  async createTransaction(input: CreateTransactionInput): Promise<ESignTransaction> {
    const res = await providerFetch<LeegalityEnvelope<LeegalitySignRequestData>>({
      method: "POST",
      url: url("/sign/request"),
      headers: authHeaders(),
      body: {
        // Our reference id. Leegality echoes `irn` on every callback, which is
        // how a webhook finds its lease_agreements row.
        irn: input.referenceId,
        file: { name: input.fileName, file: input.documentBase64 },
        invitees: [...input.signers]
          .sort((a, b) => a.order - b.order)
          .map((signer) => ({
            name: signer.name,
            email: signer.email ?? undefined,
            phone: signer.phone ?? undefined,
            // Aadhaar OTP e-Sign under IT Act s.3A — the whole point of the
            // feature. Not offering a fallback signature type is deliberate:
            // a drawn "signature" carries materially less evidentiary weight
            // and silently accepting one would undercut the agreement.
            signatureType: [{ aadhaar: { enable: true, otp: true, biometric: false } }],
            sequence: signer.order,
            expiryDate: new Date(Date.now() + input.expiresInDays * 86_400_000).toISOString(),
          })),
        callbackUrl: input.webhookUrl,
      },
      timeoutMs: 30_000,
      idempotencyKey: input.referenceId,
      // Creating a transaction twice means two documents out for signature on
      // the same lease and two invoices. `irn` is our reference id, so a
      // retry that reached them would be rejected as a duplicate — but there
      // is no reason to lean on that, so the retry budget is the minimum.
      maxAttempts: 2,
    });

    const data = res.data.data;
    if (!data?.documentId) {
      throw new ProviderError("malformed_response", `leegality returned no documentId: ${res.data.message ?? "unknown"}`, {
        httpStatus: res.httpStatus,
        detail: res.data.message,
      });
    }

    const invitations: SignerInvitation[] = (data.invitations ?? []).map((invitation, index) => ({
      role: roleForSequence(index + 1),
      signUrl: invitation.signUrl ?? null,
      expiresAt: parseDate(invitation.expiryDate),
    }));

    return { providerRef: data.documentId, invitations };
  }

  async refreshSignUrl(input: { providerRef: string; role: SignerRole }): Promise<SignerInvitation> {
    const res = await providerFetch<LeegalityEnvelope<LeegalitySignRequestData>>({
      method: "GET",
      url: url(`/document/${encodeURIComponent(input.providerRef)}`),
      headers: authHeaders(),
      timeoutMs: 15_000,
    });

    const sequence = input.role === "landlord" ? 1 : 2;
    const invitation = res.data.data?.invitations?.[sequence - 1];
    if (!invitation?.signUrl) {
      throw new ProviderError("not_found", `no active signing link for ${input.role}`, { httpStatus: res.httpStatus });
    }
    return { role: input.role, signUrl: invitation.signUrl, expiresAt: parseDate(invitation.expiryDate) };
  }

  async downloadSignedDocument(input: { providerRef: string }): Promise<Buffer> {
    // Returned base64-in-JSON rather than as a binary body, which is why this
    // does not use providerFetch's JSON path any differently — the envelope is
    // still JSON.
    const res = await providerFetch<LeegalityEnvelope<{ file?: string }>>({
      method: "GET",
      url: url(`/document/${encodeURIComponent(input.providerRef)}/download`),
      headers: authHeaders(),
      timeoutMs: 30_000,
    });

    const base64 = res.data.data?.file;
    if (!base64) {
      throw new ProviderError("malformed_response", "leegality returned no signed document", {
        httpStatus: res.httpStatus,
      });
    }
    return Buffer.from(base64, "base64");
  }

  // HMAC-SHA256 over the raw request body, compared in constant time.
  //
  // Verified against the RAW bytes, never against a re-serialized object:
  // JSON.stringify does not guarantee the provider's key order or spacing, so
  // re-encoding would produce a different digest and either fail every genuine
  // delivery or, worse, tempt someone to "fix" it by skipping verification.
  verifyWebhookSignature(input: { rawBody: Buffer; headers: Record<string, string | string[] | undefined> }): boolean {
    const secret = providerEnv.leegalityWebhookSecret;
    // Fail closed. This endpoint is unauthenticated and its whole job is to
    // mark agreements as legally signed; with no secret configured there is no
    // way to tell the provider from anyone else, so nothing is accepted.
    if (!secret) return false;

    const header = input.headers["x-leegality-signature"] ?? input.headers["x-signature"];
    const provided = Array.isArray(header) ? header[0] : header;
    if (!provided) return false;

    const expected = createHmac("sha256", secret).update(input.rawBody).digest("hex");
    // Some vendors prefix the algorithm ("sha256=<hex>"). Accept both forms.
    const normalized = provided.startsWith("sha256=") ? provided.slice("sha256=".length) : provided;
    return safeEqual(normalized.toLowerCase(), expected);
  }

  parseWebhook(payload: unknown): ESignEvent {
    const body = (payload ?? {}) as LeegalityWebhookPayload;
    const raw = body as unknown as Record<string, unknown>;

    const signedInvitation = body.invitations?.find((i) => (i.status ?? "").toLowerCase() === "signed");
    const signedCount = body.invitations?.filter((i) => (i.status ?? "").toLowerCase() === "signed").length ?? 0;

    const status = (body.event ?? body.status ?? "").toLowerCase();
    let type: ESignEvent["type"] = "unknown";
    if (/complete|success/.test(status)) type = "completed";
    else if (/decline|reject/.test(status)) type = "declined";
    else if (/expire/.test(status)) type = "expired";
    else if (/sign/.test(status)) type = "signed";

    return {
      // Falls back to a digest of the payload when the provider sends no event
      // id, so the dedupe key exists either way. Two genuinely different
      // deliveries never hash the same; an identical redelivery does, which is
      // exactly what we want to suppress.
      eventId: body.eventId ?? createHash("sha256").update(JSON.stringify(body)).digest("hex").slice(0, 32),
      type,
      providerRef: body.documentId ?? null,
      referenceId: body.irn ?? null,
      signerRole: signedInvitation ? roleForSequence(signedCount) : null,
      signedAt: parseDate(signedInvitation?.signedOn),
      raw,
    };
  }
}
