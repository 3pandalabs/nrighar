import { and, eq } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";
import { findOrLinkOwnerTenant } from "../../lib/findOrLinkOwnerTenant.js";

// Tenant-scoped list, mirroring profile_shares_tenant_all's full-CRUD RLS
// (tenant could always SELECT all their own share rows, claimed or not) —
// the tenant "Sharing" page needs this to show history and let the tenant
// revoke a previously-created share without already holding its id.
export async function listProfileShares(input: { tenantUserId: string }) {
  return db.select().from(schema.profileShares).where(eq(schema.profileShares.tenantUserId, input.tenantUserId));
}

// Tenant mints a reusable 'open' share link (used both for the link handed
// out after intake and for tenant-initiated sharing).
export async function createProfileShare(input: { tenantUserId: string }) {
  const [row] = await db.insert(schema.profileShares).values({ tenantUserId: input.tenantUserId }).returning();
  return row;
}

// Mirrors get_profile_share_preview: status + name/city/kyc_status ONLY —
// never documents, before the share is claimed.
export async function previewProfileShare(input: { token: string }) {
  const [row] = await db
    .select({
      status: schema.profileShares.status,
      fullName: schema.tenantProfiles.fullName,
      currentCity: schema.tenantProfiles.currentCity,
      kycStatus: schema.tenantProfiles.kycStatus,
    })
    .from(schema.profileShares)
    .innerJoin(schema.tenantProfiles, eq(schema.tenantProfiles.userId, schema.profileShares.tenantUserId))
    .where(eq(schema.profileShares.id, input.token));
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return row;
}

// Mirrors 0008's claim_profile_share: validate not revoked / not already
// claimed by someone else / not a self-claim, flip to claimed with
// owner_id = caller, bridge via findOrLinkOwnerTenant.
export async function claimProfileShare(input: { token: string; ownerId: string }) {
  const [share] = await db.select().from(schema.profileShares).where(eq(schema.profileShares.id, input.token));
  if (!share) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  if (share.status === "revoked") throw ApplicationFailure.create({ type: "revoked", nonRetryable: true });
  if (share.status === "claimed" && share.ownerId !== input.ownerId) {
    throw ApplicationFailure.create({ type: "already_claimed", nonRetryable: true });
  }
  if (share.tenantUserId === input.ownerId) {
    throw ApplicationFailure.create({ type: "own_profile", nonRetryable: true });
  }

  if (share.status === "open") {
    await db
      .update(schema.profileShares)
      .set({ ownerId: input.ownerId, status: "claimed", claimedAt: new Date() })
      .where(eq(schema.profileShares.id, input.token));
  }

  const tenantId = await findOrLinkOwnerTenant(
    input.ownerId,
    share.tenantUserId,
    "Linked from shared tenant profile",
  );
  if (!tenantId) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });

  return { ok: true, tenantId, tenantUserId: share.tenantUserId };
}

// Tenant revokes a share they issued — instantly cuts the owner's read
// access via hasClaimedShare() re-evaluating false on the next request.
export async function revokeProfileShare(input: { id: string; tenantUserId: string }) {
  const [row] = await db
    .update(schema.profileShares)
    .set({ status: "revoked", revokedAt: new Date() })
    .where(and(eq(schema.profileShares.id, input.id), eq(schema.profileShares.tenantUserId, input.tenantUserId)))
    .returning();
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return row;
}
