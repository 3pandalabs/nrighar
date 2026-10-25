import { proxyActivities } from "@temporalio/workflow";
import { ApplicationFailure } from "@temporalio/common";
import type * as activities from "../activities/index.js";

const {
  listUtilityAccounts,
  createUtilityAccount,
  updateUtilityAccount,
  deleteUtilityAccount,
  listUtilityBills,
  selectAccountsToFetch,
  selectBillsToAlert,
  assertOwnsUtilityAccount,
} = proxyActivities<typeof activities>({
  startToCloseTimeout: "20 seconds",
  retry: { maximumAttempts: 3 },
});

// Billable. Single attempt, same rule as everywhere else in this feature set:
// framework retries can't tell a free failure from a paid one, and
// fetchBillForAccount already pushes the account's gate out on failure so a
// broken account isn't re-charged by the next run.
const { fetchBillForAccount } = proxyActivities<typeof activities>({
  startToCloseTimeout: "60 seconds",
  retry: { maximumAttempts: 1 },
});

const { sendOverdueAlert } = proxyActivities<typeof activities>({
  startToCloseTimeout: "30 seconds",
  retry: { maximumAttempts: 2 },
});

// Ceiling per scheduled run. Bounds a single run's spend even if the account
// table grows unexpectedly or a bug clears every gate at once — the monthly
// cap in costGuard is the budget, this is the blast radius of one run.
const MAX_ACCOUNTS_PER_RUN = 200;
const MAX_ALERTS_PER_RUN = 200;

export const listUtilityAccountsWorkflow = (input: Parameters<typeof listUtilityAccounts>[0]) =>
  listUtilityAccounts(input);
export const createUtilityAccountWorkflow = (input: Parameters<typeof createUtilityAccount>[0]) =>
  createUtilityAccount(input);
export const updateUtilityAccountWorkflow = (input: Parameters<typeof updateUtilityAccount>[0]) =>
  updateUtilityAccount(input);
export const deleteUtilityAccountWorkflow = (input: Parameters<typeof deleteUtilityAccount>[0]) =>
  deleteUtilityAccount(input);
export const listUtilityBillsWorkflow = (input: Parameters<typeof listUtilityBills>[0]) => listUtilityBills(input);

/** Owner-triggered "check this account now". One account, one billable call. */
export async function fetchUtilityBillNowWorkflow(input: { accountId: string; ownerId: string }) {
  await assertOwnsUtilityAccount({ id: input.accountId, ownerId: input.ownerId });
  const outcome = await fetchBillForAccount({ accountId: input.accountId });

  if (outcome.kind === "not_configured") {
    throw ApplicationFailure.create({ type: "bbps_not_configured", nonRetryable: true });
  }
  if (outcome.kind === "failed") {
    throw ApplicationFailure.create({ message: outcome.message, type: "provider_unavailable", nonRetryable: true });
  }
  return outcome;
}

/**
 * Scheduled bill fetch. Two schedules share this one workflow (see
 * temporal/schedules.ts):
 *
 *   mode "cycle" — 1st of the month. Every active account, one call each.
 *                  This is the fetch that discovers the month's bill.
 *   mode "due"   — daily, but takes only accounts whose gate has come up,
 *                  which the cycle fetch set to that bill's due date. On the
 *                  ~28 days a month when nothing is due, this selects nothing
 *                  and spends nothing.
 *
 * So the schedule runs daily while the spend stays at two calls per account
 * per month. That is deliberately better than a genuinely twice-monthly cron:
 * a fixed "run on the 15th" would confirm the wrong day for every biller whose
 * due date isn't the 15th, and would still cost the same two calls.
 */
export async function fetchUtilityBillsWorkflow(input: { mode: "cycle" | "due" }) {
  const accounts = await selectAccountsToFetch({ mode: input.mode, limit: MAX_ACCOUNTS_PER_RUN });

  let fetched = 0;
  let noBill = 0;
  let failed = 0;
  let notConfigured = 0;

  // Sequential, not parallel. These are per-call charges against a shared
  // monthly cap, and the cap is checked inside each call — running them
  // concurrently would let a batch race past the ceiling before any of them
  // had recorded a ledger row. A few hundred sequential calls is minutes of
  // wall clock on a background schedule that has all night.
  for (const account of accounts) {
    const outcome = await fetchBillForAccount({ accountId: account.id });
    if (outcome.kind === "fetched") fetched += 1;
    else if (outcome.kind === "no_bill") noBill += 1;
    else if (outcome.kind === "failed") failed += 1;
    else {
      notConfigured += 1;
      // No provider configured — every remaining account gives the same
      // answer, so stop rather than walking the whole table to find out.
      break;
    }
  }

  return { mode: input.mode, considered: accounts.length, fetched, noBill, failed, notConfigured };
}

/**
 * Daily overdue sweep. Makes ZERO provider calls — it reads the status the
 * last fetch recorded and mails the landlord about anything unpaid past its
 * due date, with a 3-day backoff and a 4-alert cap per bill.
 *
 * Kept separate from the fetch workflow so the thing that costs money and the
 * thing that costs nothing have independent schedules and independent failure
 * modes: an alerting bug can never turn into a spending bug.
 */
export async function alertOverdueUtilityBillsWorkflow() {
  const bills = await selectBillsToAlert({ limit: MAX_ALERTS_PER_RUN });

  let sent = 0;
  for (const row of bills) {
    const result = await sendOverdueAlert({ billId: row.bill.id });
    if (result.sent) sent += 1;
  }

  return { considered: bills.length, sent };
}
