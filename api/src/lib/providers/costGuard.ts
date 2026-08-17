import { and, count, eq, gte, inArray } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";
import { providerEnv } from "./env.js";
import { ProviderError } from "./http.js";

// Every billable outbound call in this codebase goes through guardedCall().
// Nothing calls a paid provider directly — that is the invariant which makes
// the spend bounded rather than merely intended.
//
// Three gates, cheapest first:
//   1. Is the integration configured at all? (free, in-process)
//   2. Has this exact subject been looked up in the last cooldown window?
//      (one indexed count)
//   3. Is the month's cap for this operation family already spent?
//      (one indexed count)
// Then the call runs, and the outcome is written to provider_calls whether it
// succeeded or not — a ledger that only records successes cannot bound spend,
// because failed calls are billed too.
//
// Why Postgres and not Redis: this stack has no Redis, and adding one for a
// counter would mean a new container, a new backup story and a new failure
// mode for a workload of a few hundred writes a month. Postgres is already
// here, already backed up, and — unlike an in-process counter — is still
// accurate when the API and the Temporal worker both make calls, which they
// do. The in-process limiter in plugins/rateLimit.ts stays where it belongs:
// in front of unauthenticated HTTP, shedding load before it reaches a query.

// Which budget each operation draws down.
//
// Deliberately per-operation rather than per-family. Grouping the whole e-Sign
// family under one cap was wrong in a way that only shows up in use: minting a
// new agreement (genuinely per-document, genuinely expensive) and re-issuing a
// signing link (a read against a document already paid for, triggered by a
// signer every time they reopen the page) drew on the same budget. Two signers
// reopening a link a few times each turned a 200-call cap into roughly 25
// agreements, and — worse — a signer clicking around could exhaust the budget
// that stops us creating new documents.
//
// So links and documents get separate budgets. `esign.download` sits with
// links because it is a read of an already-purchased document and is bounded
// 1:1 by `esign.create` anyway (storeSignedDocument returns early once the PDF
// is filed), which makes ESIGN_MONTHLY_CAP mean the intuitive thing: agreements
// sent per month.
//
// The three identity operations DO share one budget, deliberately: one Aadhaar
// verification is an OTP call plus a submit call, and a cap counting those
// separately would be a cap on nothing an operator can reason about.
const BUDGET_BY_OPERATION = {
  "identity.pan": "identity",
  "identity.aadhaar_otp": "identity",
  "identity.aadhaar_verify": "identity",
  "esign.create": "esign_documents",
  "esign.download": "esign_links",
  "esign.refresh_url": "esign_links",
  "bbps.fetch": "bbps",
} as const;

export type BillableOperation = keyof typeof BUDGET_BY_OPERATION;
type Budget = (typeof BUDGET_BY_OPERATION)[BillableOperation];

// Typing `operation` as this union rather than `string` is the point: a new
// paid call with an operation name nobody added to the map above fails to
// compile, instead of silently running uncapped in production.
const OPERATIONS_BY_BUDGET = Object.entries(BUDGET_BY_OPERATION).reduce(
  (acc, [operation, budget]) => {
    (acc[budget as Budget] ??= []).push(operation as BillableOperation);
    return acc;
  },
  {} as Record<Budget, BillableOperation[]>,
);

export interface GuardedCallInput<T> {
  provider: string;
  // Dotted operation name. Determines both the budget it draws down and what
  // shows up in the ledger and the per-subject cooldown.
  operation: BillableOperation;
  subjectFingerprint?: string | null;
  ownerId?: string | null;
  // Suppress a repeat call for the same subject+operation within this window.
  // 0 disables it (correct for e-Sign, where two different agreements for the
  // same lease are legitimately two calls).
  cooldownSeconds?: number;
  run: () => Promise<T>;
}

function monthlyCap(budget: Budget): number {
  switch (budget) {
    case "identity":
      return providerEnv.identityMonthlyCap;
    case "esign_documents":
      return providerEnv.esignMonthlyCap;
    case "esign_links":
      return providerEnv.esignLinkMonthlyCap;
    case "bbps":
      return providerEnv.bbpsMonthlyCap;
  }
}

// Calendar month in UTC. Provider invoices are monthly, and matching their
// boundary makes "did we stay under budget" answerable against the invoice
// rather than against a rolling window nobody bills on.
function monthStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

async function billableCallsThisMonth(budget: Budget): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.providerCalls)
    .where(
      and(
        // Explicit operation list, not a `like '<family>.%'` prefix match —
        // the budget an operation belongs to is now a decision in the map
        // above rather than an accident of how it was named.
        inArray(schema.providerCalls.operation, OPERATIONS_BY_BUDGET[budget]),
        eq(schema.providerCalls.billable, true),
        gte(schema.providerCalls.createdAt, monthStart()),
      ),
    );
  return row?.n ?? 0;
}

async function calledRecently(subjectFingerprint: string, operation: string, cooldownSeconds: number): Promise<boolean> {
  const since = new Date(Date.now() - cooldownSeconds * 1000);
  const [row] = await db
    .select({ n: count() })
    .from(schema.providerCalls)
    .where(
      and(
        eq(schema.providerCalls.subjectFingerprint, subjectFingerprint),
        eq(schema.providerCalls.operation, operation),
        eq(schema.providerCalls.billable, true),
        gte(schema.providerCalls.createdAt, since),
      ),
    );
  return (row?.n ?? 0) > 0;
}

async function record(input: {
  provider: string;
  operation: string;
  subjectFingerprint?: string | null;
  ownerId?: string | null;
  billable: boolean;
  outcome: "ok" | "error" | "timeout" | "blocked";
  httpStatus?: number | null;
  durationMs?: number | null;
}): Promise<void> {
  try {
    await db.insert(schema.providerCalls).values({
      provider: input.provider,
      operation: input.operation,
      subjectFingerprint: input.subjectFingerprint ?? null,
      ownerId: input.ownerId ?? null,
      billable: input.billable,
      outcome: input.outcome,
      httpStatus: input.httpStatus ?? null,
      durationMs: input.durationMs ?? null,
    });
  } catch (err) {
    // Never let ledger bookkeeping fail the call that already happened and was
    // already paid for. Losing a ledger row loosens the cap slightly; throwing
    // here would throw away a result we just bought.
    console.error("costGuard: failed to record provider call", err);
  }
}

export async function guardedCall<T>(input: GuardedCallInput<T>): Promise<T> {
  const { provider, operation, subjectFingerprint, ownerId, cooldownSeconds = 0, run } = input;
  const budget = BUDGET_BY_OPERATION[operation];

  if (subjectFingerprint && cooldownSeconds > 0 && (await calledRecently(subjectFingerprint, operation, cooldownSeconds))) {
    await record({ provider, operation, subjectFingerprint, ownerId, billable: false, outcome: "blocked" });
    throw ApplicationFailure.create({
      message: `${operation} was already called for this subject in the last ${cooldownSeconds}s`,
      type: "provider_cooldown",
      nonRetryable: true,
    });
  }

  const cap = monthlyCap(budget);
  if (cap > 0 && (await billableCallsThisMonth(budget)) >= cap) {
    await record({ provider, operation, subjectFingerprint, ownerId, billable: false, outcome: "blocked" });
    throw ApplicationFailure.create({
      message: `monthly cap of ${cap} billable ${budget} calls is exhausted`,
      type: "provider_quota_exceeded",
      nonRetryable: true,
    });
  }

  const startedAt = Date.now();
  try {
    const result = await run();
    await record({
      provider,
      operation,
      subjectFingerprint,
      ownerId,
      billable: true,
      outcome: "ok",
      httpStatus: 200,
      durationMs: Date.now() - startedAt,
    });
    return result;
  } catch (err) {
    const providerErr = err instanceof ProviderError ? err : undefined;
    await record({
      provider,
      operation,
      subjectFingerprint,
      ownerId,
      billable: providerErr?.billable ?? true,
      outcome: providerErr?.kind === "timeout" ? "timeout" : "error",
      httpStatus: providerErr?.httpStatus ?? null,
      durationMs: Date.now() - startedAt,
    });
    throw err;
  }
}

// Ops read for the admin dashboard: what has this month cost so far, per
// operation. Cheap enough to serve inline — one grouped index scan.
export async function monthlyCallSummary(): Promise<{ operation: string; calls: number }[]> {
  return db
    .select({ operation: schema.providerCalls.operation, calls: count() })
    .from(schema.providerCalls)
    .where(and(eq(schema.providerCalls.billable, true), gte(schema.providerCalls.createdAt, monthStart())))
    .groupBy(schema.providerCalls.operation);
}
