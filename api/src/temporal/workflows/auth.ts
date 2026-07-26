import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { signupActivity, loginActivity, refreshActivity, logoutActivity, getMeActivity } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
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

// Started by a daily Temporal schedule (see ../schedules.ts), never by a route.
export const purgeExpiredSessionsWorkflow = () => purgeExpiredSessionsActivity();
