import { and, eq } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";
import { findOrLinkOwnerTenant } from "../../lib/findOrLinkOwnerTenant.js";

export async function listIntakeLinks(input: { ownerId: string }) {
  return db.select().from(schema.intakeLinks).where(eq(schema.intakeLinks.ownerId, input.ownerId));
}

export async function createIntakeLink(input: { ownerId: string; propertyId?: string }) {
  if (input.propertyId) {
    const [property] = await db
      .select({ id: schema.properties.id })
      .from(schema.properties)
      .where(and(eq(schema.properties.id, input.propertyId), eq(schema.properties.ownerId, input.ownerId)));
    if (!property) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  }
  const [row] = await db
    .insert(schema.intakeLinks)
    .values({ ownerId: input.ownerId, propertyId: input.propertyId })
    .returning();
  return row;
}

// Mirrors get_intake_link(p_token): status/expired/owner+property display data.
export async function getIntakeLink(input: { token: string }) {
  const [row] = await db
    .select({
      status: schema.intakeLinks.status,
      expiresAt: schema.intakeLinks.expiresAt,
      ownerDisplayName: schema.profiles.displayName,
      propertyNickname: schema.properties.nickname,
      propertyCity: schema.properties.city,
    })
    .from(schema.intakeLinks)
    .leftJoin(schema.profiles, eq(schema.profiles.id, schema.intakeLinks.ownerId))
    .leftJoin(schema.properties, eq(schema.properties.id, schema.intakeLinks.propertyId))
    .where(eq(schema.intakeLinks.id, input.token));
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return {
    status: row.status,
    expired: row.expiresAt < new Date(),
    ownerName: row.ownerDisplayName ?? "Your landlord",
    propertyNickname: row.propertyNickname,
    propertyCity: row.propertyCity,
  };
}

// Mirrors 0008's accept_intake_as_tenant: validate pending+not-expired,
// insert a pre-claimed profile_shares row (accepting the invite IS the
// consent), bridge via findOrLinkOwnerTenant, mark the link submitted.
export async function acceptIntakeLink(input: { token: string; tenantUserId: string }) {
  const [link] = await db.select().from(schema.intakeLinks).where(eq(schema.intakeLinks.id, input.token));
  if (!link) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  if (link.status !== "pending") throw ApplicationFailure.create({ type: "already_used", nonRetryable: true });
  if (link.expiresAt < new Date()) throw ApplicationFailure.create({ type: "expired", nonRetryable: true });

  const [tenantProfile] = await db
    .select({ userId: schema.tenantProfiles.userId })
    .from(schema.tenantProfiles)
    .where(eq(schema.tenantProfiles.userId, input.tenantUserId));
  if (!tenantProfile) throw ApplicationFailure.create({ type: "no_tenant_profile", nonRetryable: true });

  await db.insert(schema.profileShares).values({
    tenantUserId: input.tenantUserId,
    ownerId: link.ownerId,
    status: "claimed",
    claimedAt: new Date(),
  });

  const tenantId = await findOrLinkOwnerTenant(link.ownerId, input.tenantUserId, "Self-registered via intake link");

  await db
    .update(schema.intakeLinks)
    .set({ status: "submitted", tenantId, submittedAt: new Date() })
    .where(eq(schema.intakeLinks.id, input.token));

  return { ok: true };
}

export async function deleteIntakeLink(input: { id: string; ownerId: string }) {
  const [row] = await db
    .delete(schema.intakeLinks)
    .where(and(eq(schema.intakeLinks.id, input.id), eq(schema.intakeLinks.ownerId, input.ownerId)))
    .returning({ id: schema.intakeLinks.id });
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
}
