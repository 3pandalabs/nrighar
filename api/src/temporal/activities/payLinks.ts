import { and, eq } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";

// Owner-scoped list — the old Supabase RLS policy (pay_links_all_own) let an
// owner SELECT all their own rows, not just fetch one by token; there was no
// single-item-only restriction to preserve. Dashboard/mobile "rent ledger"
// views need this to show sent/opened/claimed status without already
// knowing every token.
export async function listPayLinks(input: { ownerId: string; leaseId?: string }) {
  const conditions = [eq(schema.payLinks.ownerId, input.ownerId)];
  if (input.leaseId) conditions.push(eq(schema.payLinks.leaseId, input.leaseId));
  return db
    .select()
    .from(schema.payLinks)
    .where(and(...conditions));
}

export async function createPayLink(input: {
  ownerId: string;
  leaseId: string;
  periodYear: number;
  periodMonth: number;
  amountDue: number;
}) {
  const [lease] = await db
    .select()
    .from(schema.leases)
    .where(and(eq(schema.leases.id, input.leaseId), eq(schema.leases.ownerId, input.ownerId)));
  if (!lease) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });

  const [row] = await db
    .insert(schema.payLinks)
    .values({
      ownerId: input.ownerId,
      leaseId: input.leaseId,
      periodYear: input.periodYear,
      periodMonth: input.periodMonth,
      amountDue: String(input.amountDue),
    })
    .onConflictDoUpdate({
      target: [schema.payLinks.leaseId, schema.payLinks.periodYear, schema.payLinks.periodMonth],
      set: { amountDue: String(input.amountDue) },
    })
    .returning();
  return row;
}

// Mirrors get_pay_link(p_token): join lease -> property/tenant, left-join
// profiles for the owner's UPI details.
export async function getPayLink(input: { token: string }) {
  const [row] = await db
    .select({
      amountDue: schema.payLinks.amountDue,
      periodYear: schema.payLinks.periodYear,
      periodMonth: schema.payLinks.periodMonth,
      propertyNickname: schema.properties.nickname,
      propertyCity: schema.properties.city,
      tenantName: schema.tenants.fullName,
      ownerUpiVpa: schema.profiles.upiVpa,
      ownerUpiName: schema.profiles.upiName,
      ownerDisplayName: schema.profiles.displayName,
      claimedPaidAt: schema.payLinks.claimedPaidAt,
    })
    .from(schema.payLinks)
    .innerJoin(schema.leases, eq(schema.leases.id, schema.payLinks.leaseId))
    .innerJoin(schema.properties, eq(schema.properties.id, schema.leases.propertyId))
    .innerJoin(schema.tenants, eq(schema.tenants.id, schema.leases.tenantId))
    .leftJoin(schema.profiles, eq(schema.profiles.id, schema.payLinks.ownerId))
    .where(eq(schema.payLinks.id, input.token));
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return { ...row, ownerUpiName: row.ownerUpiName ?? row.ownerDisplayName };
}

export async function openPayLink(input: { token: string }) {
  const [row] = await db
    .select({ openedAt: schema.payLinks.openedAt })
    .from(schema.payLinks)
    .where(eq(schema.payLinks.id, input.token));
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  if (!row.openedAt) {
    await db.update(schema.payLinks).set({ openedAt: new Date() }).where(eq(schema.payLinks.id, input.token));
  }
}

export async function claimPayLinkPaid(input: { token: string }) {
  const [row] = await db
    .select({ claimedPaidAt: schema.payLinks.claimedPaidAt })
    .from(schema.payLinks)
    .where(eq(schema.payLinks.id, input.token));
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  if (!row.claimedPaidAt) {
    await db.update(schema.payLinks).set({ claimedPaidAt: new Date() }).where(eq(schema.payLinks.id, input.token));
  }
}
