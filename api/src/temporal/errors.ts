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
  own_profile: 400,
  revoked: 409,
  already_claimed: 409,
  email_in_use: 409,
  expired: 410,
  already_used: 409,
  no_tenant_profile: 422,
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
