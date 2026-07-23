import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { listTenants, createTenant, getTenant, updateTenant, deleteTenant } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export const listTenantsWorkflow = (input: Parameters<typeof listTenants>[0]) => listTenants(input);
export const createTenantWorkflow = (input: Parameters<typeof createTenant>[0]) => createTenant(input);
export const getTenantWorkflow = (input: Parameters<typeof getTenant>[0]) => getTenant(input);
export const updateTenantWorkflow = (input: Parameters<typeof updateTenant>[0]) => updateTenant(input);
export const deleteTenantWorkflow = (input: Parameters<typeof deleteTenant>[0]) => deleteTenant(input);
