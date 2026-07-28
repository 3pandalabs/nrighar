import { ScheduleAlreadyRunning } from "@temporalio/client";
import { getTemporalClient } from "./client.js";
import { temporalEnv } from "./env.js";

// Background schedules are registered by the worker at boot, for the same
// reason Drizzle migrations run at api container start (see
// infra/coolify-setup.md): a step that must happen exactly once, but must not
// depend on a human remembering it after a redeploy or a server rebuild.
//
// create() is the idempotent call here because ScheduleAlreadyRunning is
// swallowed — every redeploy re-runs this and does nothing. Note that means an
// *existing* schedule is left exactly as it is: changing a cron expression
// below will not take effect on deploy. Delete the schedule (`temporal schedule
// delete --schedule-id <id>`) and let the next worker boot recreate it, or
// update it in place from the Temporal UI.
const SCHEDULES = [
  {
    scheduleId: "nrighar-purge-expired-sessions",
    workflowType: "purgeExpiredSessionsWorkflow",
    // 03:30 UTC daily — 09:00 IST, outside the window when anyone is likely to
    // be logging in. cronExpressions with no `timezone` is UTC.
    cronExpressions: ["30 3 * * *"],
    workflowExecutionTimeout: "10 minutes",
  },
] as const;

// Never throws: a worker that cannot register a background schedule must still
// go on to poll the task queue, because since PR #8 every HTTP route in this
// app is served by a workflow on that queue. Failing to purge stale rows is a
// housekeeping problem; failing to poll is a total outage.
export async function ensureSchedules(): Promise<void> {
  for (const { scheduleId, workflowType, cronExpressions, workflowExecutionTimeout } of SCHEDULES) {
    try {
      const client = await getTemporalClient();
      await client.schedule.create({
        scheduleId,
        spec: { cronExpressions: [...cronExpressions] },
        action: {
          type: "startWorkflow",
          workflowType,
          taskQueue: temporalEnv.taskQueue,
          workflowExecutionTimeout,
        },
        // Overlap policy left at its default (SKIP): if a purge somehow outruns
        // its next slot, skipping is right — the following day's run deletes
        // whatever the slow one didn't.
      });
      console.log(`nrighar-worker: created schedule "${scheduleId}" (${cronExpressions.join(", ")} UTC)`);
    } catch (err) {
      if (err instanceof ScheduleAlreadyRunning) {
        console.log(`nrighar-worker: schedule "${scheduleId}" already exists`);
        continue;
      }
      console.error(`nrighar-worker: failed to ensure schedule "${scheduleId}"`, err);
    }
  }
}
