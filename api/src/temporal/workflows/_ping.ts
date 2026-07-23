import { proxyActivities } from "@temporalio/workflow";
import type * as activities from "../activities/index.js";

const { ping } = proxyActivities<typeof activities>({
  startToCloseTimeout: "10 seconds",
});

export async function pingWorkflow(message: string): Promise<string> {
  return ping(message);
}
