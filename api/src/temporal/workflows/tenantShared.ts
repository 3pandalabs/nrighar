import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { getTenantProfileByOwner, listTenantDocumentsByOwner } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export const getTenantProfileByOwnerWorkflow = (input: Parameters<typeof getTenantProfileByOwner>[0]) =>
  getTenantProfileByOwner(input);
export const listTenantDocumentsByOwnerWorkflow = (input: Parameters<typeof listTenantDocumentsByOwner>[0]) =>
  listTenantDocumentsByOwner(input);
