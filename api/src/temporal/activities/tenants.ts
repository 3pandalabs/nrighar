import { and, eq } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";

type TenantBody = {
  fullName: string;
  phone?: string;
  email?: string;
  kycStatus?: "pending" | "submitted" | "verified";
  notes?: string;
};

export async function listTenants(input: { ownerId: string }) {
  return db.select().from(schema.tenants).where(eq(schema.tenants.ownerId, input.ownerId));
}

export async function createTenant(input: { ownerId: string; body: TenantBody }) {
  const [row] = await db
    .insert(schema.tenants)
    .values({ ...input.body, ownerId: input.ownerId })
    .returning();
  return row;
}

export async function getTenant(input: { id: string; ownerId: string }) {
  const [row] = await db
    .select()
    .from(schema.tenants)
    .where(and(eq(schema.tenants.id, input.id), eq(schema.tenants.ownerId, input.ownerId)));
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return row;
}

export async function updateTenant(input: { id: string; ownerId: string; body: Partial<TenantBody> }) {
  const [row] = await db
    .update(schema.tenants)
    .set(input.body)
    .where(and(eq(schema.tenants.id, input.id), eq(schema.tenants.ownerId, input.ownerId)))
    .returning();
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return row;
}

export async function deleteTenant(input: { id: string; ownerId: string }) {
  const [row] = await db
    .delete(schema.tenants)
    .where(and(eq(schema.tenants.id, input.id), eq(schema.tenants.ownerId, input.ownerId)))
    .returning({ id: schema.tenants.id });
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
}
