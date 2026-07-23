import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { listLeases, createLease, getLease, updateLease, deleteLease } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export const listLeasesWorkflow = (input: Parameters<typeof listLeases>[0]) => listLeases(input);
export const createLeaseWorkflow = (input: Parameters<typeof createLease>[0]) => createLease(input);
export const getLeaseWorkflow = (input: Parameters<typeof getLease>[0]) => getLease(input);
export const updateLeaseWorkflow = (input: Parameters<typeof updateLease>[0]) => updateLease(input);
export const deleteLeaseWorkflow = (input: Parameters<typeof deleteLease>[0]) => deleteLease(input);
