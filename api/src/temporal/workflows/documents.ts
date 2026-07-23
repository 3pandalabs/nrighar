import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { listDocuments, createDocument, deleteDocument } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export const listDocumentsWorkflow = (input: Parameters<typeof listDocuments>[0]) => listDocuments(input);
export const createDocumentWorkflow = (input: Parameters<typeof createDocument>[0]) => createDocument(input);
export const deleteDocumentWorkflow = (input: Parameters<typeof deleteDocument>[0]) => deleteDocument(input);
