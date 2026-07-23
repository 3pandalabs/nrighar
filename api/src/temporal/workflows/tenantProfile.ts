import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { getTenantProfile, updateTenantProfile, listTenantDocuments, createTenantDocument, deleteTenantDocument } =
  proxyActivities<typeof activities>({
    startToCloseTimeout: "10 seconds",
    retry: { maximumAttempts: 3 },
  });

export const getTenantProfileWorkflow = (input: Parameters<typeof getTenantProfile>[0]) => getTenantProfile(input);
export const updateTenantProfileWorkflow = (input: Parameters<typeof updateTenantProfile>[0]) =>
  updateTenantProfile(input);
export const listTenantDocumentsWorkflow = (input: Parameters<typeof listTenantDocuments>[0]) =>
  listTenantDocuments(input);
export const createTenantDocumentWorkflow = (input: Parameters<typeof createTenantDocument>[0]) =>
  createTenantDocument(input);
export const deleteTenantDocumentWorkflow = (input: Parameters<typeof deleteTenantDocument>[0]) =>
  deleteTenantDocument(input);
