import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { listPayLinks, createPayLink, getPayLink, openPayLink, claimPayLinkPaid } = proxyActivities<
  typeof activities
>({
  startToCloseTimeout: "10 seconds",
  retry: { maximumAttempts: 3 },
});

export const listPayLinksWorkflow = (input: Parameters<typeof listPayLinks>[0]) => listPayLinks(input);
export const createPayLinkWorkflow = (input: Parameters<typeof createPayLink>[0]) => createPayLink(input);
export const getPayLinkWorkflow = (input: Parameters<typeof getPayLink>[0]) => getPayLink(input);
export const openPayLinkWorkflow = (input: Parameters<typeof openPayLink>[0]) => openPayLink(input);
export const claimPayLinkPaidWorkflow = (input: Parameters<typeof claimPayLinkPaid>[0]) => claimPayLinkPaid(input);
