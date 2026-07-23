import { and, eq } from "drizzle-orm";
import { log } from "@temporalio/activity";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";
import { deleteObject } from "../../plugins/r2.js";

type TenantProfilePatchBody = {
  fullName?: string;
  phone?: string;
  email?: string;
  currentCity?: string;
  employer?: string;
  kycStatus?: "pending" | "submitted" | "verified";
};

type TenantDocBody = {
  docType?: "agreement" | "kyc" | "property_paper" | "tax" | "other";
  title: string;
  storagePath: string;
};

export async function getTenantProfile(input: { userId: string }) {
  const [row] = await db.select().from(schema.tenantProfiles).where(eq(schema.tenantProfiles.userId, input.userId));
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return row;
}

export async function updateTenantProfile(input: { userId: string; body: TenantProfilePatchBody }) {
  const [row] = await db
    .update(schema.tenantProfiles)
    .set(input.body)
    .where(eq(schema.tenantProfiles.userId, input.userId))
    .returning();
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return row;
}

export async function listTenantDocuments(input: { userId: string }) {
  return db.select().from(schema.tenantDocuments).where(eq(schema.tenantDocuments.tenantUserId, input.userId));
}

export async function createTenantDocument(input: { userId: string; body: TenantDocBody }) {
  const [row] = await db
    .insert(schema.tenantDocuments)
    .values({ ...input.body, tenantUserId: input.userId })
    .returning();
  return row;
}

export async function deleteTenantDocument(input: { id: string; userId: string }) {
  const [existing] = await db
    .select({ storagePath: schema.tenantDocuments.storagePath })
    .from(schema.tenantDocuments)
    .where(and(eq(schema.tenantDocuments.id, input.id), eq(schema.tenantDocuments.tenantUserId, input.userId)));
  if (!existing) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  try {
    await deleteObject(existing.storagePath);
  } catch (err) {
    log.warn("failed to delete R2 object for tenant document", { err, id: input.id });
  }
  await db
    .delete(schema.tenantDocuments)
    .where(and(eq(schema.tenantDocuments.id, input.id), eq(schema.tenantDocuments.tenantUserId, input.userId)));
}
