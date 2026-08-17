import { providerEnv } from "../providers/env.js";
import { ProviderError, providerFetch } from "../providers/http.js";
import type {
  AadhaarOtpInit,
  AadhaarOtpVerification,
  IdentityKycProvider,
  PanVerification,
} from "./provider.js";

// SurePass adapter.
//
// IMPORTANT before going live: the request/response field names below follow
// SurePass's published v1 KYC API (`/pan/pan`, `/aadhaar-v2/generate-otp`,
// `/aadhaar-v2/submit-otp`). Aggregator payloads drift, and this file was
// written without a sandbox account to call against — check each shape against
// the current docs for your contract, and exercise it in their sandbox before
// pointing production at it. Everything outside this file is provider-agnostic,
// so corrections stay local to it.
//
// The response envelope is the same for all three: a JSON object with
// `success`, `status_code`, `message(_code)` and a `data` payload. A 200 with
// `success: false` is a real, billed answer that happens to be negative — it
// is decoded, not retried.

interface SurepassEnvelope<T> {
  data?: T;
  success?: boolean;
  status_code?: number;
  message?: string;
  message_code?: string;
}

interface SurepassPanData {
  client_id?: string;
  pan_number?: string;
  full_name?: string;
  category?: string;
  // Present on the richer PAN products; absent on the basic one.
  aadhaar_linked?: boolean;
  dob_verified?: boolean;
}

interface SurepassOtpInitData {
  client_id?: string;
  otp_sent?: boolean;
  // SurePass reports whether the number is even eligible for OTP before
  // sending — a `false` here is a negative answer, not a transport failure.
  if_number?: boolean;
  valid_aadhaar?: boolean;
}

interface SurepassOtpVerifyData {
  client_id?: string;
  full_name?: string;
  aadhaar_number?: string; // already masked by SurePass
  dob?: string;
  gender?: string;
  care_of?: string;
  address?: Record<string, unknown>;
  zip?: string;
  profile_image?: string;
}

function authHeaders(): Record<string, string> {
  return { authorization: `Bearer ${providerEnv.surepassToken}` };
}

function url(path: string): string {
  return `${providerEnv.surepassBaseUrl.replace(/\/$/, "")}${path}`;
}

// Strips everything we are not willing to keep. `details` is persisted
// verbatim into identity_verifications.details and read back over the API, so
// the filtering happens here rather than at the call site — a new adapter
// can't accidentally widen what gets stored.
//
// Dropped on purpose: profile_image (a photograph of the person — we have no
// use for it and every reason not to hold it) and zip/full address, which is
// residence data the landlord did not ask for and this feature does not need.
function sanitizeAadhaar(data: SurepassOtpVerifyData): Record<string, unknown> {
  return {
    dob: data.dob ?? null,
    gender: data.gender ?? null,
    care_of: data.care_of ?? null,
    // Only the coarse jurisdiction, never the street address.
    state: (data.address as { state?: string } | undefined)?.state ?? null,
    district: (data.address as { dist?: string } | undefined)?.dist ?? null,
  };
}

export class SurepassIdentityProvider implements IdentityKycProvider {
  readonly name = "surepass";

  async verifyPan(input: { panNumber: string; idempotencyKey: string }): Promise<PanVerification> {
    const res = await providerFetch<SurepassEnvelope<SurepassPanData>>({
      method: "POST",
      url: url("/pan/pan"),
      headers: authHeaders(),
      body: { id_number: input.panNumber },
      idempotencyKey: input.idempotencyKey,
      timeoutMs: 12_000,
    });

    const { data, success, message } = res.data;

    // A well-formed PAN that simply does not exist comes back as a negative
    // success rather than a 404 at most aggregators. That is a definitive
    // answer worth caching, not an error worth retrying.
    if (success === false || !data?.full_name) {
      const missing = /not\s*found|invalid|no\s*record/i.test(message ?? "");
      if (missing) {
        return { found: false, registeredName: null, providerRef: data?.client_id ?? null, details: { message } };
      }
      throw new ProviderError("malformed_response", `surepass PAN lookup returned no name: ${message ?? "unknown"}`, {
        httpStatus: res.httpStatus,
        detail: message,
      });
    }

    return {
      found: true,
      registeredName: data.full_name,
      providerRef: data.client_id ?? null,
      details: {
        category: data.category ?? null,
        aadhaar_linked: data.aadhaar_linked ?? null,
      },
    };
  }

  async sendAadhaarOtp(input: { aadhaarNumber: string; idempotencyKey: string }): Promise<AadhaarOtpInit> {
    const res = await providerFetch<SurepassEnvelope<SurepassOtpInitData>>({
      method: "POST",
      url: url("/aadhaar-v2/generate-otp"),
      headers: authHeaders(),
      body: { id_number: input.aadhaarNumber },
      idempotencyKey: input.idempotencyKey,
      timeoutMs: 20_000,
      // OTP generation sends an SMS to a real person. Two attempts, not the
      // default three: an over-eager retry both costs money and lands a second
      // code in the tenant's inbox, which reliably makes them enter the wrong
      // one.
      maxAttempts: 2,
    });

    const { data, success, message } = res.data;
    if (success === false || !data?.client_id) {
      throw new ProviderError("invalid_request", `surepass could not send an Aadhaar OTP: ${message ?? "unknown"}`, {
        httpStatus: res.httpStatus,
        detail: message,
      });
    }

    return { clientId: data.client_id, providerRef: data.client_id };
  }

  async submitAadhaarOtp(input: { clientId: string; otp: string }): Promise<AadhaarOtpVerification> {
    const res = await providerFetch<SurepassEnvelope<SurepassOtpVerifyData>>({
      method: "POST",
      url: url("/aadhaar-v2/submit-otp"),
      headers: authHeaders(),
      body: { client_id: input.clientId, otp: input.otp },
      timeoutMs: 20_000,
      // Never retried. UIDAI allows a fixed number of OTP submissions per
      // session, so a retry can burn the tenant's remaining attempts on an
      // identical guess and force the whole (paid) session to be started over.
      maxAttempts: 1,
    });

    const { data, success, message } = res.data;
    if (success === false || !data?.full_name) {
      // Wrong OTP is the common case here and is a user error, not a fault.
      const wrongOtp = /otp/i.test(message ?? "") && /invalid|incorrect|expire/i.test(message ?? "");
      throw new ProviderError(wrongOtp ? "invalid_request" : "malformed_response", `surepass OTP submit failed: ${message ?? "unknown"}`, {
        httpStatus: res.httpStatus,
        detail: message,
      });
    }

    return {
      verified: true,
      registeredName: data.full_name,
      maskedNumber: data.aadhaar_number ?? null,
      providerRef: data.client_id ?? input.clientId,
      details: sanitizeAadhaar(data),
    };
  }
}
