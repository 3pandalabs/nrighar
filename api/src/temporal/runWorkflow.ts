import { randomUUID } from "node:crypto";
import type { FastifyReply } from "fastify";
import type { Duration } from "@temporalio/common";
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
export interface RunWorkflowOptions {
  // Overrides the 20-second default. Only for routes that legitimately wait on
  // a third party: a PAN lookup or an e-Sign transaction can spend most of a
  // minute inside one provider call plus its retries, and cutting that off at
  // 20s abandons a call that has already been billed for. Everything talking
  // only to Postgres/R2 should keep the default — a fast failure is the point.
  workflowExecutionTimeout?: Duration;
  // Stable id for a workflow that must not run twice concurrently. Temporal
  // rejects a duplicate id while the first execution is still running, which
  // is a cheaper way to get "one at a time per subject" than any lock we could
  // write. Left unset, each call gets a fresh random id as before.
  workflowId?: string;
}

export async function runWorkflow<T>(
  workflowType: string,
  args: unknown[],
  options: RunWorkflowOptions = {},
): Promise<T> {
  try {
    const client = await getTemporalClient();
    return await client.workflow.execute(workflowType, {
      taskQueue: temporalEnv.taskQueue,
      workflowId: options.workflowId ?? `${workflowType}-${randomUUID()}`,
      workflowExecutionTimeout: options.workflowExecutionTimeout ?? "20 seconds",
      args,
    });
  } catch (err) {
    // getTemporalClient() itself can throw (e.g. a stale TEMPORAL_ADDRESS
    // failing to connect) — that used to happen outside this try/catch, so
    // toHttpFailure() never ran and sendWorkflow's `{ status, body } = err`
    // destructured undefined, crashing on `reply.code(undefined)` instead
    // of returning a clean 500. Moving the call in here means every
    // failure path — connection or workflow — goes through the same
    // fallback-to-500 handling in toHttpFailure().
    throw toHttpFailure(err);
  }
}

// Start a workflow WITHOUT waiting for it. For callers that must be acked
// before the work finishes — currently the e-Sign webhook, where the provider
// retries anything it doesn't get a fast 2xx for, and a slow handler turns one
// signature event into a stream of duplicate deliveries.
//
// The caller supplies a deterministic workflowId so a redelivery that beats
// the dedupe row lands on the same execution and is rejected by Temporal
// rather than run twice.
export async function startWorkflowDetached(
  workflowType: string,
  args: unknown[],
  options: RunWorkflowOptions & { workflowId: string },
): Promise<void> {
  const client = await getTemporalClient();
  await client.workflow.start(workflowType, {
    taskQueue: temporalEnv.taskQueue,
    workflowId: options.workflowId,
    workflowExecutionTimeout: options.workflowExecutionTimeout ?? "5 minutes",
    args,
  });
}

// Shared route-handler shape: run the workflow, reply with its result on
// success, or with the mapped HTTP status/body on failure.
export async function sendWorkflow<T>(
  reply: FastifyReply,
  workflowType: string,
  args: unknown[],
  successStatus = 200,
  options: RunWorkflowOptions = {},
): Promise<FastifyReply> {
  try {
    const result = await runWorkflow<T>(workflowType, args, options);
    return reply.code(successStatus).send(result);
  } catch (err) {
    const { status, body } = err as HttpFailure;
    return reply.code(status).send(body);
  }
}
