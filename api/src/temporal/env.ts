import "dotenv/config";

// Kept separate from ../env.js deliberately: the worker process is deployed
// as its own Coolify resource and never touches Postgres/JWT/R2, so it
// shouldn't inherit the main app's required-env checks for those.
export const temporalEnv = {
  address: process.env.TEMPORAL_ADDRESS ?? "localhost:7233",
  namespace: process.env.TEMPORAL_NAMESPACE ?? "default",
  taskQueue: process.env.TEMPORAL_TASK_QUEUE ?? "nrighar",
};
