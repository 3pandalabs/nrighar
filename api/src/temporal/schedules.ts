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
    args: [],
    workflowExecutionTimeout: "10 minutes",
  },
  {
    // BBPS cycle fetch — the one guaranteed billable call per active utility
    // account per month. 04:30 UTC on the 1st = 10:00 IST, by which point the
    // boards have posted the month's bills.
    scheduleId: "nrighar-utility-bill-cycle",
    workflowType: "fetchUtilityBillsWorkflow",
    cronExpressions: ["30 4 1 * *"],
    args: [{ mode: "cycle" }],
    // Sequential, one provider call at a time, up to 200 accounts.
    workflowExecutionTimeout: "2 hours",
  },
  {
    // Due-date confirmation. Runs daily but is gated on each account's
    // next_fetch_after, which the cycle fetch set to that bill's due date — so
    // it makes no provider calls at all on the ~28 days when nothing is due,
    // and buys exactly one confirmation on the day one is. Total: two calls
    // per account per month, with the confirmation landing on the *right* day
    // for each biller rather than on a fixed date that suits none of them.
    scheduleId: "nrighar-utility-bill-due-check",
    workflowType: "fetchUtilityBillsWorkflow",
    cronExpressions: ["0 5 * * *"],
    args: [{ mode: "due" }],
    workflowExecutionTimeout: "1 hour",
  },
  {
    // Overdue alerts. Reads only what the fetches already stored and makes
    // zero provider calls, which is why it can afford to run daily. Separate
    // from the fetch schedule on purpose: the thing that costs money and the
    // thing that costs nothing should never share a failure mode.
    scheduleId: "nrighar-utility-bill-alerts",
    workflowType: "alertOverdueUtilityBillsWorkflow",
    cronExpressions: ["0 6 * * *"],
    args: [],
    workflowExecutionTimeout: "30 minutes",
  },
] as const;

// Never throws: a worker that cannot register a background schedule must still
// go on to poll the task queue, because since PR #8 every HTTP route in this
// app is served by a workflow on that queue. Failing to purge stale rows is a
// housekeeping problem; failing to poll is a total outage.
export async function ensureSchedules(): Promise<void> {
  for (const { scheduleId, workflowType, cronExpressions, args, workflowExecutionTimeout } of SCHEDULES) {
    try {
      const client = await getTemporalClient();
      await client.schedule.create({
        scheduleId,
        spec: { cronExpressions: [...cronExpressions] },
        action: {
          type: "startWorkflow",
          workflowType,
          taskQueue: temporalEnv.taskQueue,
          args: [...args],
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
