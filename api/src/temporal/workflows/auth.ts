import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { signupActivity, loginActivity, refreshActivity, logoutActivity, getMeActivity } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export const signupWorkflow = (input: Parameters<typeof signupActivity>[0]) => signupActivity(input);
export const loginWorkflow = (input: Parameters<typeof loginActivity>[0]) => loginActivity(input);
export const refreshWorkflow = (input: Parameters<typeof refreshActivity>[0]) => refreshActivity(input);
export const logoutWorkflow = (input: Parameters<typeof logoutActivity>[0]) => logoutActivity(input);
export const getMeWorkflow = (input: Parameters<typeof getMeActivity>[0]) => getMeActivity(input);
