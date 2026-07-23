// One-off smoke test: `npm run temporal:ping` starts pingWorkflow and prints
// the result, proving client -> server -> worker -> activity connectivity.
import { getTemporalClient } from "./client.js";
import { temporalEnv } from "./env.js";

async function main() {
  const client = await getTemporalClient();
  const result = await client.workflow.execute("pingWorkflow", {
    taskQueue: temporalEnv.taskQueue,
    workflowId: `ping-${Date.now()}`,
    args: ["hello from nrighar-api"],
  });
  console.log("workflow result:", result);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
