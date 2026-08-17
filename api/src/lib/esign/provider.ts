// Contract every Aadhaar e-Sign vendor is adapted to.
//
// Same motivation as the identity seam: e-Sign is priced per signature or per
// document, the market (Leegality, SignDesk, Digio, Cashfree) moves on price,
// and switching should cost one adapter.
//
// The sequencing requirement is expressed here rather than left to each
// vendor's defaults: signers carry an explicit `order`, and every
// implementation must ensure a signer is not invited until everyone ahead of
// them has signed. Where a provider supports sequential invitations natively
// we use it; where it does not, the adapter sends invitations one stage at a
// time and the webhook advances them.

export type SignerRole = "landlord" | "tenant";

export interface ESignSigner {
  role: SignerRole;
  order: number;
  name: string;
  email: string | null;
  phone: string | null;
}

export interface CreateTransactionInput {
  // The unsigned agreement, base64. Providers take the document inline rather
  // than fetching a URL, which suits a private R2 bucket well — nothing has to
  // be made publicly readable for signing to work.
  documentBase64: string;
  fileName: string;
  signers: ESignSigner[];
  // Our own id for the transaction, echoed back on webhooks. This is what ties
  // a callback to a lease_agreements row without trusting anything else in the
  // payload.
  referenceId: string;
  webhookUrl: string;
  expiresInDays: number;
}

export interface SignerInvitation {
  role: SignerRole;
  signUrl: string | null;
  expiresAt: Date | null;
}

export interface ESignTransaction {
  providerRef: string;
  invitations: SignerInvitation[];
}

export type ESignEventType = "signed" | "completed" | "declined" | "expired" | "unknown";

export interface ESignEvent {
  // Provider's own id for this delivery. The webhook dedupe key — a provider
  // that does not supply one gets a deterministic digest of the payload
  // instead (see the adapter).
  eventId: string;
  type: ESignEventType;
  providerRef: string | null;
  referenceId: string | null;
  // Present on a per-signer event.
  signerRole: SignerRole | null;
  signedAt: Date | null;
  raw: Record<string, unknown>;
}

export interface ESignProvider {
  readonly name: string;

  createTransaction(input: CreateTransactionInput): Promise<ESignTransaction>;

  /** Fresh signing URL for one signer — provider links are short-lived. */
  refreshSignUrl(input: { providerRef: string; role: SignerRole }): Promise<SignerInvitation>;

  /** The final, signed, tamper-evident PDF. Only meaningful once complete. */
  downloadSignedDocument(input: { providerRef: string }): Promise<Buffer>;

  /**
   * Authenticates a raw webhook body. Returns false for anything it cannot
   * positively verify — an unauthenticated caller must never be able to move
   * an agreement to `completed`.
   */
  verifyWebhookSignature(input: { rawBody: Buffer; headers: Record<string, string | string[] | undefined> }): boolean;

  parseWebhook(payload: unknown): ESignEvent;
}
