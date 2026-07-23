import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { validateIntakeLinkForSubmission, finalizeIntakeSubmission } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export const validateIntakeLinkForSubmissionWorkflow = (
  input: Parameters<typeof validateIntakeLinkForSubmission>[0],
) => validateIntakeLinkForSubmission(input);
export const finalizeIntakeSubmissionWorkflow = (input: Parameters<typeof finalizeIntakeSubmission>[0]) =>
  finalizeIntakeSubmission(input);
