import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

// 15s ceiling for the same reason as the password-reset proxy: runWorkflow.ts
// caps a workflow execution at 20 seconds. maximumAttempts stays at 1 so a
// transient gateway blip can't deliver the same message to support twice.
const { sendContactMessageActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "15 seconds",
  retry: { maximumAttempts: 1 },
});

export const sendContactMessageWorkflow = (input: Parameters<typeof sendContactMessageActivity>[0]) =>
  sendContactMessageActivity(input);
