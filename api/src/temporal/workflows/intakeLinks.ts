import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { listIntakeLinks, createIntakeLink, getIntakeLink, acceptIntakeLink, deleteIntakeLink } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export const listIntakeLinksWorkflow = (input: Parameters<typeof listIntakeLinks>[0]) => listIntakeLinks(input);
export const createIntakeLinkWorkflow = (input: Parameters<typeof createIntakeLink>[0]) => createIntakeLink(input);
export const getIntakeLinkWorkflow = (input: Parameters<typeof getIntakeLink>[0]) => getIntakeLink(input);
export const acceptIntakeLinkWorkflow = (input: Parameters<typeof acceptIntakeLink>[0]) => acceptIntakeLink(input);
export const deleteIntakeLinkWorkflow = (input: Parameters<typeof deleteIntakeLink>[0]) => deleteIntakeLink(input);
