import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { listProfileShares, createProfileShare, previewProfileShare, claimProfileShare, revokeProfileShare } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: "10 seconds",
    retry: { maximumAttempts: 3 },
  });

export const listProfileSharesWorkflow = (input: Parameters<typeof listProfileShares>[0]) =>
  listProfileShares(input);
export const createProfileShareWorkflow = (input: Parameters<typeof createProfileShare>[0]) =>
  createProfileShare(input);
export const previewProfileShareWorkflow = (input: Parameters<typeof previewProfileShare>[0]) =>
  previewProfileShare(input);
export const claimProfileShareWorkflow = (input: Parameters<typeof claimProfileShare>[0]) =>
  claimProfileShare(input);
export const revokeProfileShareWorkflow = (input: Parameters<typeof revokeProfileShare>[0]) =>
  revokeProfileShare(input);
