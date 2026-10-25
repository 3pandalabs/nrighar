// The contract every identity-KYC aggregator is adapted to.
//
// Kept deliberately narrow — three calls, no provider types leaking through —
// because the reason this seam exists is price. Aggregator per-call pricing for
// PAN and Aadhaar moves often enough that swapping vendors is a routine
// commercial decision, and it should cost one adapter file, not a rewrite of
// the workflows.
//
// Two things every implementation must honour:
//   1. Never invent a positive result. A provider that is unreachable, or
//      unconfigured, or answers something unrecognised, must throw — the
//      caller turns that into `failed`/`not_configured`, never `verified`.
//   2. Never return the full document number in `details`. Callers persist
//      that object as-is.

export interface PanVerification {
  // false = the number is well-formed but no such PAN exists upstream.
  found: boolean;
  // Name as the government source holds it. Null when found is false.
  registeredName: string | null;
  providerRef: string | null;
  details: Record<string, unknown> | null;
}

export interface AadhaarOtpInit {
  // Provider-side handle for the OTP session. This is what makes the second
  // call chargeable-once: it is the only way back to the session we paid for.
  clientId: string;
  providerRef: string | null;
}

export interface AadhaarOtpVerification {
  verified: boolean;
  registeredName: string | null;
  // The provider's own masked rendering of the number, when it returns one.
  maskedNumber: string | null;
  providerRef: string | null;
  details: Record<string, unknown> | null;
}

export interface IdentityKycProvider {
  readonly name: string;

  /** Instant PAN lookup: number in, registered name out. One billable call. */
  verifyPan(input: { panNumber: string; idempotencyKey: string }): Promise<PanVerification>;

  /** Triggers the UIDAI OTP to the Aadhaar-linked mobile. One billable call. */
  sendAadhaarOtp(input: { aadhaarNumber: string; idempotencyKey: string }): Promise<AadhaarOtpInit>;

  /**
   * Exchanges the OTP for the offline-eKYC payload. One billable call, and
   * one that must never be retried automatically — see the adapter.
   */
  submitAadhaarOtp(input: { clientId: string; otp: string }): Promise<AadhaarOtpVerification>;
}
