import "dotenv/config";

// Configuration for the three paid external integrations (identity KYC,
// e-Sign, BBPS bill fetch).
//
// Deliberately NOT part of ../../env.js's required() checks — same reasoning as
// lib/kyc/env.ts. This file is imported by both the API server and the Temporal
// worker, and every one of these integrations is optional: a RentVault deploy
// with none of them configured must still boot and collect rent. A missing key
// disables exactly one feature, surfaced as a `not_configured` status on the
// row the caller reads back, and never as a boot failure or a fabricated
// "verified".
//
// Every provider here is swappable by env var alone (see the index.ts in each
// lib/identity, lib/esign, lib/bbps folder). That is the point: these are the
// most price-volatile dependencies in the stack, and per-call pricing between
// aggregators moves enough that being locked to one is a real cost.

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export const providerEnv = {
  // --- Identity KYC (PAN / Aadhaar) -------------------------------------
  // "surepass" | "none". Any unrecognised value is treated as "none".
  identityProvider: process.env.IDENTITY_KYC_PROVIDER ?? "none",
  surepassBaseUrl: process.env.SUREPASS_BASE_URL ?? "https://kyc-api.surepass.io/api/v1",
  surepassToken: process.env.SUREPASS_TOKEN ?? "",

  // --- e-Sign -----------------------------------------------------------
  // "leegality" | "none".
  esignProvider: process.env.ESIGN_PROVIDER ?? "none",
  leegalityBaseUrl: process.env.LEEGALITY_BASE_URL ?? "https://api.leegality.com/api/v3.0",
  leegalityAuthToken: process.env.LEEGALITY_AUTH_TOKEN ?? "",
  // Shared secret the provider signs webhook bodies with. Without it the
  // webhook route refuses every delivery — an unauthenticated endpoint that
  // marks agreements as signed is not something to fail open on.
  leegalityWebhookSecret: process.env.LEEGALITY_WEBHOOK_SECRET ?? "",
  // Public URL the provider posts completion callbacks to. Not derived from
  // the request Host for the same reason WEB_ORIGIN isn't.
  esignWebhookUrl: process.env.ESIGN_WEBHOOK_URL ?? "",

  // --- BBPS bill fetch --------------------------------------------------
  // "setu" | "none".
  bbpsProvider: process.env.BBPS_PROVIDER ?? "none",
  setuBaseUrl: process.env.SETU_BASE_URL ?? "https://prod.setu.co/api/v2",
  setuClientId: process.env.SETU_CLIENT_ID ?? "",
  setuClientSecret: process.env.SETU_CLIENT_SECRET ?? "",
  setuProductInstanceId: process.env.SETU_PRODUCT_INSTANCE_ID ?? "",

  // --- Secrets ----------------------------------------------------------
  // HMAC key for number fingerprints. Falls back to JWT_SECRET so a deploy
  // that forgets it still gets a *keyed* digest rather than a bare hash —
  // Aadhaar's 12-digit keyspace is small enough that an unkeyed SHA-256 of it
  // is reversible by brute force in minutes. Rotating this invalidates the
  // verification cache (old fingerprints stop matching); it does not lose any
  // verification history.
  fingerprintSecret: process.env.KYC_FINGERPRINT_SECRET || process.env.JWT_SECRET || "",

  // --- Cost ceilings ----------------------------------------------------
  // Hard caps on billable calls per calendar month, per operation family.
  // Reaching one returns `provider_quota_exceeded` to the caller and skips
  // the account in the cron worker; it does not queue the call for later.
  // These are the last line of defence against a bug that loops — the
  // caches, cooldowns and schedules below are what keep normal usage far
  // beneath them.
  identityMonthlyCap: num("IDENTITY_KYC_MONTHLY_CAP", 500),
  esignMonthlyCap: num("ESIGN_MONTHLY_CAP", 200),
  bbpsMonthlyCap: num("BBPS_MONTHLY_CAP", 1000),

  // --- Cache freshness --------------------------------------------------
  // How long a successful verification is reused instead of re-billed. A PAN
  // holder's name does not change; the long default is a deliberate cost
  // choice, not an oversight. Aadhaar is shorter because the OTP flow proves
  // possession of the phone at a point in time, which stales faster than the
  // name-to-number binding it also proves.
  panCacheDays: num("PAN_CACHE_DAYS", 180),
  aadhaarCacheDays: num("AADHAAR_CACHE_DAYS", 30),

  // Per-subject cooldown between billable identity lookups on the same
  // number, regardless of caller. Blunt, and intentionally so: it bounds a
  // retry storm that a cache miss would otherwise let straight through.
  identityCooldownSeconds: num("IDENTITY_COOLDOWN_SECONDS", 60),

  // How long a provider-side Aadhaar OTP session is assumed good for. Used to
  // decide whether a repeat "send OTP" reuses the live session (free) or buys
  // a new one. Kept slightly under the usual 10-minute provider TTL so we
  // never hand back a session that expires mid-submit.
  aadhaarOtpTtlSeconds: num("AADHAAR_OTP_TTL_SECONDS", 8 * 60),
};

export type IdentityProviderName = "surepass" | "none";
export type ESignProviderName = "leegality" | "none";
export type BbpsProviderName = "setu" | "none";
