import { ApplicationFailure } from "@temporalio/common";
import { WorkflowFailedError } from "@temporalio/client";
import type { HttpFailure } from "./runWorkflow.js";

// Same string codes the routes returned inline before this migration.
// Anything absent falls through to 500/internal_error, matching the old
// global setErrorHandler's default.
const STATUS_BY_TYPE: Record<string, number> = {
  not_found: 404,
  conflict: 409,
  invalid_credentials: 401,
  invalid_refresh_token: 401,
  not_authenticated: 401,
  forbidden: 403,
  tenant_role_required: 403,
  invalid_key: 400,
  invalid_or_expired_token: 400,
  own_profile: 400,
  revoked: 409,
  already_claimed: 409,
  email_in_use: 409,
  expired: 410,
  already_used: 409,
  no_tenant_profile: 422,
  // Identity KYC / e-Sign / BBPS. The 4xx codes are all caller-fixable; the
  // 429s and 503s are the cost controls and the provider seams talking.
  invalid_pan: 400,
  invalid_aadhaar: 400,
  invalid_role: 400,
  otp_session_unusable: 409,
  otp_verification_failed: 400,
  // Both cost guards. 429 rather than 402/403: the caller is not forbidden,
  // they are asking too often or too much this month, and retrying later is
  // the right advice.
  provider_cooldown: 429,
  provider_quota_exceeded: 429,
  // Configuration gaps, deliberately distinguishable from a provider outage so
  // ops can tell "we never set this up" from "they're down".
  identity_not_configured: 503,
  esign_not_configured: 503,
  bbps_not_configured: 503,
  provider_unavailable: 503,
  // The contact form has nowhere to deliver to (mailer unconfigured or the
  // gateway rejected every message). 503, not 500: the request was fine, the
  // dependency isn't, and the caller should be told to try again later.
  mailer_unavailable: 503,
  // tenantIntake.ts predates the snake_case error-code convention used
  // elsewhere — it returns free-text messages as the body's `error` field, so
  // these ApplicationFailure `type`s are the literal strings, not codes.
  "This link doesn't exist": 404,
  "This link was already used": 409,
  "This link has expired": 410,
};

// Walk the cause chain rather than assuming a fixed depth: a workflow that
// awaits one activity fails with WorkflowFailedError -> ActivityFailure ->
// ApplicationFailure, but that depth isn't guaranteed to stay constant as
// workflows evolve.
function findApplicationFailure(err: unknown): ApplicationFailure | undefined {
  let cur: unknown = err;
  while (cur instanceof Error) {
    if (cur instanceof ApplicationFailure) return cur;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

export function toHttpFailure(err: unknown): HttpFailure {
  if (err instanceof WorkflowFailedError) {
    const appFailure = findApplicationFailure(err);
    if (appFailure?.type && STATUS_BY_TYPE[appFailure.type]) {
      return { status: STATUS_BY_TYPE[appFailure.type], body: { error: appFailure.type } };
    }
  }
  return { status: 500, body: { error: "internal_error" } };
}
