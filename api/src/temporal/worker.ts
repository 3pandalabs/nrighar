import { extname } from "node:path";
import { fileURLToPath } from "node:url";
import { NativeConnection, Worker } from "@temporalio/worker";
import * as activities from "./activities.js";
import { temporalEnv } from "./env.js";

// Temporal's workflow bundler reads workflows.ts/.js straight off disk,
// independent of how this file itself is being run. Match the extension of
// *this* module's URL so the same worker.ts works both under `tsx watch`
// (URL ends in .ts, source read directly) and as compiled dist/*.js (URL
// ends in .js, no source present in the runtime image).
const workflowsPath = fileURLToPath(new URL(`./workflows${extname(import.meta.url)}`, import.meta.url));

async function run() {
  const connection = await NativeConnection.connect({ address: temporalEnv.address });
  try {
    const worker = await Worker.create({
      connection,
      namespace: temporalEnv.namespace,
      taskQueue: temporalEnv.taskQueue,
      workflowsPath,
      activities,
    });
    console.log(`nrighar-worker: polling task queue "${temporalEnv.taskQueue}" at ${temporalEnv.address}`);
    await worker.run();
  } finally {
    await connection.close();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
