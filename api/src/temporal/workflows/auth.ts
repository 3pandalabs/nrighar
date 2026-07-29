import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { signupActivity, loginActivity, refreshActivity, logoutActivity, getMeActivity } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

// Own proxy: requesting a reset makes an outbound HTTP call to the shared
// mailer gateway, so 10s is too tight. maximumAttempts is 1 — a retry would
// invalidate the token it just mailed and send a second link, so a caller who
// clicked the first one would find it already dead. sendMail already swallows
// gateway failures internally, so nothing here throws on an undelivered mail.
// 15s, not more: runWorkflow.ts caps every workflow execution at 20 seconds, so
// an activity timeout above that could never fire — the workflow would die
// first and the caller would get a 500 instead of a clean failure.
const { requestPasswordResetActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 seconds",
  retry: { maximumAttempts: 1 },
});

const { resetPasswordActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  // Not idempotent: it burns the token, so a retry after a partial failure
  // would report "invalid_or_expired_token" for a reset that actually worked.
  retry: { maximumAttempts: 1 },
});

// Own proxy: this one is not on an HTTP request's critical path, so it gets a
// timeout sized for a DELETE over a table that may have gone years without a
// purge, rather than the 10s the request-serving activities above share.
const { purgeExpiredSessionsActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "5 minutes",
  retry: { maximumAttempts: 3 },
});

export const signupWorkflow = (input: Parameters<typeof signupActivity>[0]) => signupActivity(input);
export const loginWorkflow = (input: Parameters<typeof loginActivity>[0]) => loginActivity(input);
export const refreshWorkflow = (input: Parameters<typeof refreshActivity>[0]) => refreshActivity(input);
export const logoutWorkflow = (input: Parameters<typeof logoutActivity>[0]) => logoutActivity(input);
export const getMeWorkflow = (input: Parameters<typeof getMeActivity>[0]) => getMeActivity(input);
export const requestPasswordResetWorkflow = (input: Parameters<typeof requestPasswordResetActivity>[0]) =>
  requestPasswordResetActivity(input);
export const resetPasswordWorkflow = (input: Parameters<typeof resetPasswordActivity>[0]) =>
  resetPasswordActivity(input);

// Started by a daily Temporal schedule (see ../schedules.ts), never by a route.
export const purgeExpiredSessionsWorkflow = () => purgeExpiredSessionsActivity();
