import { ApiError } from "@/lib/api/client";

// Turns the API's `{ "error": "<code>" }` codes into something a landlord or
// tenant can act on.
//
// Most of this app lets a Server Action throw and shows the error boundary,
// which is fine for "add a property". It is not fine for the KYC and billing
// flows: those fail in ways the *user* can fix (wrong OTP, mistyped PAN) and in
// ways only *we* can (quota exhausted, provider down), and the two need
// visibly different copy — otherwise someone retypes a correct OTP four times
// against an exhausted monthly cap.
//
// The rule for the second kind: say plainly that it's our side, and never
// suggest a retry that we know will fail the same way.
const MESSAGES: Record<string, string> = {
  // The caller can fix these.
  invalid_pan: "That doesn't look like a valid PAN. It should be 10 characters, like ABCPE1234F.",
  invalid_aadhaar: "That Aadhaar number isn't valid — check the digits and try again.",
  otp_verification_failed: "That OTP wasn't accepted. Check the code and try again.",
  otp_session_unusable:
    "This code has expired or been used up. Request a new OTP to start again.",
  invalid_role: "That signing role isn't valid.",

  // We can fix these; the caller cannot.
  provider_cooldown: "This was just checked a moment ago. Give it a minute before trying again.",
  provider_quota_exceeded:
    "We've hit this month's verification limit. Nothing you can do — please contact support and we'll raise it.",
  rate_limited: "Too many attempts in a short time. Please wait a few minutes and try again.",
  identity_not_configured:
    "ID verification isn't switched on for this account yet. Please contact support.",
  esign_not_configured: "e-Signing isn't switched on for this account yet. Please contact support.",
  bbps_not_configured:
    "Automatic bill checking isn't switched on for this account yet. Please contact support.",
  provider_unavailable:
    "The verification service isn't responding right now. Please try again in a few minutes.",
  mailer_unavailable: "We couldn't send that email. Please try again shortly.",

  // Generic.
  not_found: "We couldn't find that.",
  conflict: "That already exists.",
  not_authenticated: "Please sign in again.",
  internal_error: "Something went wrong on our side. Please try again.",
};

export function describeApiError(err: unknown): string {
  if (err instanceof ApiError) {
    return MESSAGES[err.code] ?? "Something went wrong. Please try again.";
  }
  return "Something went wrong. Please try again.";
}

/** Shape every KYC/billing Server Action returns instead of throwing. */
export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string };
