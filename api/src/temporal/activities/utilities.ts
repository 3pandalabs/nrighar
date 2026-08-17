import { and, asc, eq, isNull, lte, or, sql } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";
import { env } from "../../env.js";
import { getBbpsProvider } from "../../lib/bbps/index.js";
import { guardedCall } from "../../lib/providers/costGuard.js";
import { fingerprint } from "../../lib/providers/fingerprint.js";
import { ProviderError } from "../../lib/providers/http.js";
import { sendMail } from "../../lib/mailer.js";
import { buildUtilityBillOverdueEmail } from "../../lib/emails/utilityBill.js";

// After this many consecutive failures an account stops being polled and waits
// for a human. A wrong consumer number fails identically every time, and
// retrying it monthly forever is a small permanent charge for a guaranteed
// error.
const MAX_CONSECUTIVE_FAILURES = 3;

// Days between repeat alerts on the same unpaid bill, and the cap. Daily mail
// about a bill the landlord has already seen trains them to filter us.
const ALERT_INTERVAL_DAYS = 3;
const MAX_ALERTS_PER_BILL = 4;

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function startOfNextMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 4, 0, 0));
}

// Consumer numbers are not secret the way an Aadhaar number is, but they are
// enough to look up someone's electricity account, so they are masked
// everywhere they are shown or mailed.
export function maskConsumerNumber(value: string): string {
  if (value.length <= 4) return "*".repeat(value.length);
  return `${"*".repeat(value.length - 4)}${value.slice(-4)}`;
}

// --- Account CRUD (owner-scoped) -------------------------------------------

async function assertOwnsProperty(ownerId: string, propertyId: string) {
  const [property] = await db
    .select({ id: schema.properties.id })
    .from(schema.properties)
    .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.ownerId, ownerId)));
  if (!property) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
}

export async function listUtilityAccounts(input: { ownerId: string; propertyId?: string }) {
  const rows = await db
    .select()
    .from(schema.utilityAccounts)
    .where(
      input.propertyId
        ? and(
            eq(schema.utilityAccounts.ownerId, input.ownerId),
            eq(schema.utilityAccounts.propertyId, input.propertyId),
          )
        : eq(schema.utilityAccounts.ownerId, input.ownerId),
    )
    .orderBy(asc(schema.utilityAccounts.createdAt));

  return rows.map((row) => ({ ...row, consumerNumber: maskConsumerNumber(row.consumerNumber) }));
}

export async function createUtilityAccount(input: {
  ownerId: string;
  body: {
    propertyId: string;
    category: string;
    billerId: string;
    billerName?: string;
    consumerNumber: string;
    nickname?: string;
  };
}) {
  await assertOwnsProperty(input.ownerId, input.body.propertyId);

  const [row] = await db
    .insert(schema.utilityAccounts)
    .values({
      ...input.body,
      ownerId: input.ownerId,
      // Null means "eligible on the next cycle run". A new account is picked
      // up by the next monthly fetch rather than triggering an immediate
      // billable call on save — registering an account should be free.
      nextFetchAfter: null,
    })
    .returning();

  return { ...row!, consumerNumber: maskConsumerNumber(row!.consumerNumber) };
}

export async function updateUtilityAccount(input: {
  id: string;
  ownerId: string;
  body: Partial<{ category: string; billerId: string; billerName: string; consumerNumber: string; nickname: string; active: boolean }>;
}) {
  const [row] = await db
    .update(schema.utilityAccounts)
    .set({
      ...input.body,
      // Any edit to the biller or consumer number clears the failure counter:
      // the operator is most likely fixing exactly what was failing, and
      // leaving it parked would keep the account dormant after the fix.
      ...(input.body.billerId || input.body.consumerNumber
        ? { consecutiveFailures: 0, lastErrorMessage: null }
        : {}),
    })
    .where(and(eq(schema.utilityAccounts.id, input.id), eq(schema.utilityAccounts.ownerId, input.ownerId)))
    .returning();
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return { ...row, consumerNumber: maskConsumerNumber(row.consumerNumber) };
}

export async function deleteUtilityAccount(input: { id: string; ownerId: string }) {
  const [row] = await db
    .delete(schema.utilityAccounts)
    .where(and(eq(schema.utilityAccounts.id, input.id), eq(schema.utilityAccounts.ownerId, input.ownerId)))
    .returning({ id: schema.utilityAccounts.id });
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
}

// --- Bill reads ------------------------------------------------------------

export async function listUtilityBills(input: { ownerId: string; accountId?: string }) {
  return db
    .select()
    .from(schema.utilityBills)
    .where(
      input.accountId
        ? and(eq(schema.utilityBills.ownerId, input.ownerId), eq(schema.utilityBills.accountId, input.accountId))
        : eq(schema.utilityBills.ownerId, input.ownerId),
    )
    .orderBy(sql`${schema.utilityBills.dueDate} desc nulls last`);
}

// --- Scheduled fetching ----------------------------------------------------

/**
 * The accounts a scheduled run is allowed to spend money on.
 *
 * `mode: "cycle"` is the 1st-of-month run and takes every active account —
 * that is the one guaranteed fetch per account per month.
 *
 * `mode: "due"` is the daily sweep and takes only accounts whose
 * `next_fetch_after` gate has passed, which the previous fetch set to the
 * bill's due date. So the daily schedule costs nothing on the ~28 days when no
 * account is at its due date, and buys exactly one confirmation call on the
 * day one is. Two calls per account per month, and the cron frequency is
 * decoupled from the spend.
 */
export async function selectAccountsToFetch(input: { mode: "cycle" | "due"; limit: number }) {
  const gate =
    input.mode === "cycle"
      ? or(isNull(schema.utilityAccounts.nextFetchAfter), lte(schema.utilityAccounts.nextFetchAfter, new Date()))
      : and(
          sql`${schema.utilityAccounts.nextFetchAfter} is not null`,
          lte(schema.utilityAccounts.nextFetchAfter, new Date()),
        );

  return db
    .select({ id: schema.utilityAccounts.id })
    .from(schema.utilityAccounts)
    .where(
      and(
        eq(schema.utilityAccounts.active, true),
        sql`${schema.utilityAccounts.consecutiveFailures} < ${MAX_CONSECUTIVE_FAILURES}`,
        gate,
      ),
    )
    .orderBy(asc(schema.utilityAccounts.nextFetchAfter))
    .limit(input.limit);
}

/**
 * One billable bill fetch, then an upsert keyed on the billing period.
 *
 * The upsert is what makes the due-date confirmation call safe: fetching the
 * same bill again updates the row (typically UNPAID → PAID) rather than
 * creating a second one, so "did they pay it" is a single-row question.
 */
export async function fetchBillForAccount(input: { accountId: string }) {
  const [account] = await db
    .select()
    .from(schema.utilityAccounts)
    .where(eq(schema.utilityAccounts.id, input.accountId));
  if (!account) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });

  const provider = getBbpsProvider();
  if (!provider) return { kind: "not_configured" as const };

  const subject = fingerprint(`${account.billerId}:${account.consumerNumber}`);

  try {
    const bill = await guardedCall({
      provider: provider.name,
      family: "bbps",
      operation: "bbps.fetch",
      subjectFingerprint: subject,
      ownerId: account.ownerId,
      // Six hours. Nothing legitimate re-fetches the same connection twice in
      // a day — the schedules are a month and a due-date apart — so this only
      // ever catches a loop or a hand-triggered double press.
      cooldownSeconds: 6 * 60 * 60,
      run: () =>
        provider.fetchBill({
          billerId: account.billerId,
          consumerNumber: account.consumerNumber,
          // Stable within a calendar day: a same-day retry re-reads the first
          // response at providers that honour the header rather than being
          // charged again.
          idempotencyKey: `bbps:${subject}:${today()}`,
        }),
    });

    if (!bill.found) {
      // No bill outstanding. Perfectly normal — wait for the next cycle rather
      // than polling for one to appear.
      await db
        .update(schema.utilityAccounts)
        .set({
          lastFetchedAt: new Date(),
          nextFetchAfter: startOfNextMonth(),
          consecutiveFailures: 0,
          lastErrorMessage: null,
        })
        .where(eq(schema.utilityAccounts.id, account.id));
      return { kind: "no_bill" as const };
    }

    // Bill number when the biller gives one, else the billing month. Either
    // way a re-fetch of the same bill lands on the same row.
    const periodKey = bill.billNumber ?? bill.billPeriod ?? (bill.billDate ?? today()).slice(0, 7);

    const [row] = await db
      .insert(schema.utilityBills)
      .values({
        accountId: account.id,
        ownerId: account.ownerId,
        billPeriodKey: periodKey,
        billNumber: bill.billNumber,
        billDate: bill.billDate,
        dueDate: bill.dueDate,
        amountDue: bill.amountDue,
        status: bill.status,
        provider: provider.name,
        fetchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.utilityBills.accountId, schema.utilityBills.billPeriodKey],
        set: {
          amountDue: bill.amountDue,
          status: bill.status,
          dueDate: bill.dueDate,
          billDate: bill.billDate,
          fetchedAt: new Date(),
        },
      })
      .returning();

    // The gate for the next call: the due date if it is still ahead (so the
    // daily sweep buys exactly one confirmation on that day), otherwise next
    // month's cycle. A bill already settled needs neither.
    const dueDate = bill.dueDate ? new Date(`${bill.dueDate}T04:00:00Z`) : null;
    const nextFetchAfter =
      bill.status === "UNPAID" && dueDate && dueDate.getTime() > Date.now() ? dueDate : startOfNextMonth();

    await db
      .update(schema.utilityAccounts)
      .set({ lastFetchedAt: new Date(), nextFetchAfter, consecutiveFailures: 0, lastErrorMessage: null })
      .where(eq(schema.utilityAccounts.id, account.id));

    return { kind: "fetched" as const, billId: row!.id, status: row!.status };
  } catch (err) {
    const message = err instanceof ProviderError ? err.message : String(err);

    // Push the gate out regardless of the failure, so a permanently broken
    // account cannot be retried by the next scheduled run: without this, a
    // bad consumer number is a fresh charge every single sweep.
    await db
      .update(schema.utilityAccounts)
      .set({
        lastFetchedAt: new Date(),
        nextFetchAfter: startOfNextMonth(),
        consecutiveFailures: sql`${schema.utilityAccounts.consecutiveFailures} + 1`,
        lastErrorMessage: message.slice(0, 500),
      })
      .where(eq(schema.utilityAccounts.id, account.id));

    if (err instanceof ProviderError) return { kind: "failed" as const, message };
    throw err;
  }
}

// --- Overdue alerting (no external calls) ----------------------------------

/**
 * Unpaid bills past their due date that are due an alert.
 *
 * Reads only from utility_bills — it makes no provider calls at all, which is
 * why the alert sweep can run daily while the fetches stay at two a month. The
 * status it alerts on is whatever the last fetch recorded, which is the honest
 * thing to tell a landlord and is what the email says.
 */
export async function selectBillsToAlert(input: { limit: number }) {
  const intervalAgo = new Date(Date.now() - ALERT_INTERVAL_DAYS * 86_400_000);

  return db
    .select({
      bill: schema.utilityBills,
      account: schema.utilityAccounts,
      property: schema.properties,
      ownerEmail: schema.users.email,
      ownerName: schema.profiles.displayName,
    })
    .from(schema.utilityBills)
    .innerJoin(schema.utilityAccounts, eq(schema.utilityAccounts.id, schema.utilityBills.accountId))
    .innerJoin(schema.properties, eq(schema.properties.id, schema.utilityAccounts.propertyId))
    .innerJoin(schema.users, eq(schema.users.id, schema.utilityBills.ownerId))
    .leftJoin(schema.profiles, eq(schema.profiles.id, schema.utilityBills.ownerId))
    .where(
      and(
        // UNPAID only. An UNKNOWN status is never alerted on — see
        // lib/bbps/setu.ts toStatus().
        eq(schema.utilityBills.status, "UNPAID"),
        sql`${schema.utilityBills.dueDate} is not null`,
        sql`${schema.utilityBills.dueDate} < current_date`,
        sql`${schema.utilityBills.alertCount} < ${MAX_ALERTS_PER_BILL}`,
        or(isNull(schema.utilityBills.lastAlertedAt), lte(schema.utilityBills.lastAlertedAt, intervalAgo)),
      ),
    )
    .orderBy(asc(schema.utilityBills.dueDate))
    .limit(input.limit);
}

export async function sendOverdueAlert(input: { billId: string }) {
  const [row] = await db
    .select({
      bill: schema.utilityBills,
      account: schema.utilityAccounts,
      property: schema.properties,
      ownerEmail: schema.users.email,
      ownerName: schema.profiles.displayName,
    })
    .from(schema.utilityBills)
    .innerJoin(schema.utilityAccounts, eq(schema.utilityAccounts.id, schema.utilityBills.accountId))
    .innerJoin(schema.properties, eq(schema.properties.id, schema.utilityAccounts.propertyId))
    .innerJoin(schema.users, eq(schema.users.id, schema.utilityBills.ownerId))
    .leftJoin(schema.profiles, eq(schema.profiles.id, schema.utilityBills.ownerId))
    .where(eq(schema.utilityBills.id, input.billId));

  if (!row) return { sent: false };

  const dueDate = row.bill.dueDate;
  const daysOverdue = dueDate
    ? Math.max(1, Math.floor((Date.now() - new Date(`${dueDate}T00:00:00Z`).getTime()) / 86_400_000))
    : 1;

  const result = await sendMail(
    [
      buildUtilityBillOverdueEmail({
        to: row.ownerEmail,
        landlordName: row.ownerName ?? "there",
        propertyNickname: row.property.nickname,
        category: row.account.category,
        billerName: row.account.billerName,
        consumerNumberMasked: maskConsumerNumber(row.account.consumerNumber),
        amountDue: row.bill.amountDue,
        dueDate,
        daysOverdue,
        dashboardUrl: `${env.WEB_ORIGIN.replace(/\/$/, "")}/dashboard/properties/${row.account.propertyId}`,
      }),
    ],
    (msg) => console.log(`utility-bill alert: ${msg}`),
  );

  // Counted only on an actual delivery. A mailer outage must not consume the
  // landlord's four alerts and leave them never told.
  if (result.delivered > 0) {
    await db
      .update(schema.utilityBills)
      .set({ lastAlertedAt: new Date(), alertCount: sql`${schema.utilityBills.alertCount} + 1` })
      .where(eq(schema.utilityBills.id, input.billId));
  }

  return { sent: result.delivered > 0 };
}

// Ownership check for the manual "fetch now" route, kept separate from the
// fetch itself so the scheduled path doesn't carry an owner argument it has no
// use for.
export async function assertOwnsUtilityAccount(input: { id: string; ownerId: string }) {
  const [row] = await db
    .select({ id: schema.utilityAccounts.id })
    .from(schema.utilityAccounts)
    .where(and(eq(schema.utilityAccounts.id, input.id), eq(schema.utilityAccounts.ownerId, input.ownerId)));
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return { id: row.id };
}
