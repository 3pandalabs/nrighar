import { randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import { getTemporalClient } from "./client.js";
import { temporalEnv } from "./env.js";
import { toHttpFailure } from "./errors.js";

export interface HttpFailure {
  status: number;
  body: { error: string };
}

// Every route handler's single call site: start `workflowType` on the shared
// task queue, wait for the result, and normalize any failure to an
// { status, body } pair the caller can reply with directly. A short
// workflowExecutionTimeout means a dead worker/Temporal server fails the HTTP
// request fast instead of hanging it indefinitely.
export async function runWorkflow<T>(workflowType: string, args: unknown[]): Promise<T> {
  const client = await getTemporalClient();
  try {
    return await client.workflow.execute(workflowType, {
      taskQueue: temporalEnv.taskQueue,
      workflowId: `${workflowType}-${randomUUID()}`,
      workflowExecutionTimeout: "20 seconds",
      args,
    });
  } catch (err) {
    throw toHttpFailure(err);
  }
}

// Shared route-handler shape: run the workflow, reply with its result on
// success, or with the mapped HTTP status/body on failure.
export async function sendWorkflow<T>(
  reply: FastifyReply,
  workflowType: string,
  args: unknown[],
  successStatus = 200,
): Promise<FastifyReply> {
  try {
    const result = await runWorkflow<T>(workflowType, args);
    return reply.code(successStatus).send(result);
  } catch (err) {
    const { status, body } = err as HttpFailure;
    return reply.code(status).send(body);
  }
}
