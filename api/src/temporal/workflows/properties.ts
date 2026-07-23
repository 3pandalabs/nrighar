import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { listProperties, createProperty, getProperty, updateProperty, deleteProperty } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export const listPropertiesWorkflow = (input: Parameters<typeof listProperties>[0]) => listProperties(input);
export const createPropertyWorkflow = (input: Parameters<typeof createProperty>[0]) => createProperty(input);
export const getPropertyWorkflow = (input: Parameters<typeof getProperty>[0]) => getProperty(input);
export const updatePropertyWorkflow = (input: Parameters<typeof updateProperty>[0]) => updateProperty(input);
export const deletePropertyWorkflow = (input: Parameters<typeof deleteProperty>[0]) => deleteProperty(input);
