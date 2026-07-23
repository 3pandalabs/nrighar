import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { getProfile, updateProfile } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export const getProfileWorkflow = (input: Parameters<typeof getProfile>[0]) => getProfile(input);
export const updateProfileWorkflow = (input: Parameters<typeof updateProfile>[0]) => updateProfile(input);
