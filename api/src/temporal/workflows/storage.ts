import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { presignUploadActivity, presignDownloadActivity } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export const presignUploadWorkflow = (input: Parameters<typeof presignUploadActivity>[0]) =>
  presignUploadActivity(input);
export const presignDownloadWorkflow = (input: Parameters<typeof presignDownloadActivity>[0]) =>
  presignDownloadActivity(input);
