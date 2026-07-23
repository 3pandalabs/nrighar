import { and, eq } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";

type UpsertBody = {
  leaseId: string;
  periodYear: number;
  periodMonth: number;
  amountDue: number;
  amountPaid?: number;
  paidOn?: string;
  method?: "bank_transfer" | "upi" | "cash" | "other";
  status?: "due" | "paid" | "partial";
  notes?: string;
};

async function assertOwnsLease(ownerId: string, leaseId: string) {
  const [lease] = await db
    .select({ id: schema.leases.id })
    .from(schema.leases)
    .where(and(eq(schema.leases.id, leaseId), eq(schema.leases.ownerId, ownerId)));
  return Boolean(lease);
}

export async function listRentPayments(input: { ownerId: string }) {
  return db.select().from(schema.rentPayments).where(eq(schema.rentPayments.ownerId, input.ownerId));
}

// One row per lease per month; the original app upserts rather than doing
// separate create/update flows — mirror that with onConflictDoUpdate on the
// (lease_id, period_year, period_month) unique constraint.
export async function upsertRentPayment(input: { ownerId: string; body: UpsertBody }) {
  if (!(await assertOwnsLease(input.ownerId, input.body.leaseId))) {
    throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  }
  const values = {
    ownerId: input.ownerId,
    leaseId: input.body.leaseId,
    periodYear: input.body.periodYear,
    periodMonth: input.body.periodMonth,
    amountDue: String(input.body.amountDue),
    amountPaid: input.body.amountPaid !== undefined ? String(input.body.amountPaid) : undefined,
    paidOn: input.body.paidOn,
    method: input.body.method,
    status: input.body.status,
    notes: input.body.notes,
  };
  const [row] = await db
    .insert(schema.rentPayments)
    .values(values)
    .onConflictDoUpdate({
      target: [schema.rentPayments.leaseId, schema.rentPayments.periodYear, schema.rentPayments.periodMonth],
      set: values,
    })
    .returning();
  return row;
}

export async function deleteRentPayment(input: { id: string; ownerId: string }) {
  const [row] = await db
    .delete(schema.rentPayments)
    .where(and(eq(schema.rentPayments.id, input.id), eq(schema.rentPayments.ownerId, input.ownerId)))
    .returning({ id: schema.rentPayments.id });
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
}
