import { and, eq } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";

type LeaseBody = {
  propertyId: string;
  tenantId: string;
  rentAmount: number;
  depositAmount?: number;
  startDate: string;
  endDate?: string;
  rentDueDay?: number;
  status?: "active" | "ended";
};

// Note beyond the original RLS: the Supabase policy only ever checked
// `owner_id = auth.uid()` on the leases row itself, not that propertyId/
// tenantId actually belong to that owner (no such FK-content check existed).
// We close that gap here since it's a one-query addition — verify both
// references are the caller's own before creating a lease.
async function assertOwnsPropertyAndTenant(ownerId: string, propertyId: string, tenantId: string) {
  const [property] = await db
    .select({ id: schema.properties.id })
    .from(schema.properties)
    .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.ownerId, ownerId)));
  const [tenant] = await db
    .select({ id: schema.tenants.id })
    .from(schema.tenants)
    .where(and(eq(schema.tenants.id, tenantId), eq(schema.tenants.ownerId, ownerId)));
  return Boolean(property) && Boolean(tenant);
}

export async function listLeases(input: { ownerId: string }) {
  return db.select().from(schema.leases).where(eq(schema.leases.ownerId, input.ownerId));
}

export async function createLease(input: { ownerId: string; body: LeaseBody }) {
  if (!(await assertOwnsPropertyAndTenant(input.ownerId, input.body.propertyId, input.body.tenantId))) {
    throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  }
  const [row] = await db
    .insert(schema.leases)
    .values({
      ...input.body,
      rentAmount: String(input.body.rentAmount),
      depositAmount: input.body.depositAmount !== undefined ? String(input.body.depositAmount) : undefined,
      ownerId: input.ownerId,
    })
    .returning();
  return row;
}

export async function getLease(input: { id: string; ownerId: string }) {
  const [row] = await db
    .select()
    .from(schema.leases)
    .where(and(eq(schema.leases.id, input.id), eq(schema.leases.ownerId, input.ownerId)));
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return row;
}

export async function updateLease(input: { id: string; ownerId: string; body: Partial<LeaseBody> }) {
  const { rentAmount, depositAmount, ...rest } = input.body;
  const [row] = await db
    .update(schema.leases)
    .set({
      ...rest,
      ...(rentAmount !== undefined ? { rentAmount: String(rentAmount) } : {}),
      ...(depositAmount !== undefined ? { depositAmount: String(depositAmount) } : {}),
    })
    .where(and(eq(schema.leases.id, input.id), eq(schema.leases.ownerId, input.ownerId)))
    .returning();
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return row;
}

export async function deleteLease(input: { id: string; ownerId: string }) {
  const [row] = await db
    .delete(schema.leases)
    .where(and(eq(schema.leases.id, input.id), eq(schema.leases.ownerId, input.ownerId)))
    .returning({ id: schema.leases.id });
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
}
