import { eq } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";
import { hasClaimedShare } from "../../plugins/authz.js";

// The two share-conditional owner-reads (tenant_profiles_select_shared /
// tenant_documents_select_shared). An owner may read a tenant's profile/docs
// ONLY while a claimed profile_shares row links them — checked via the single
// shared hasClaimedShare() predicate, never re-derived inline here.
export async function getTenantProfileByOwner(input: { tenantUserId: string; ownerId: string }) {
  if (!(await hasClaimedShare(input.tenantUserId, input.ownerId))) {
    throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  }
  const [row] = await db.select().from(schema.tenantProfiles).where(eq(schema.tenantProfiles.userId, input.tenantUserId));
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return row;
}

export async function listTenantDocumentsByOwner(input: { tenantUserId: string; ownerId: string }) {
  if (!(await hasClaimedShare(input.tenantUserId, input.ownerId))) {
    throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  }
  return db.select().from(schema.tenantDocuments).where(eq(schema.tenantDocuments.tenantUserId, input.tenantUserId));
}
