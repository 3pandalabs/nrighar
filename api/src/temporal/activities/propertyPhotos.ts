import { and, asc, eq } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";
import { deleteObject, presignDownload } from "../../plugins/r2.js";

// Cap per property. Presigning is a local HMAC (no network), but a gallery
// still has to be fetched and rendered by a phone on Indian mobile data, and
// the browse query presigns a cover for every listing on the page.
const MAX_PHOTOS_PER_PROPERTY = 20;

async function assertOwnedProperty(propertyId: string, ownerId: string) {
  const [property] = await db
    .select({ id: schema.properties.id })
    .from(schema.properties)
    .where(and(eq(schema.properties.id, propertyId), eq(schema.properties.ownerId, ownerId)));
  if (!property) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
}

// storagePath must be under the caller's own R2 prefix — the same rule
// presignUploadActivity enforces at upload time. Re-checked here rather than
// trusted, so a row can never point at an object the caller couldn't have
// written (e.g. another owner's KYC document, which would then be readable by
// any tenant browsing the listing).
export async function addPropertyPhotoActivity(input: {
  ownerId: string;
  propertyId: string;
  storagePath: string;
  caption?: string;
}) {
  await assertOwnedProperty(input.propertyId, input.ownerId);

  if (!input.storagePath.startsWith(`${input.ownerId}/`)) {
    throw ApplicationFailure.create({ type: "forbidden", nonRetryable: true });
  }

  const existing = await db
    .select({ id: schema.propertyPhotos.id })
    .from(schema.propertyPhotos)
    .where(eq(schema.propertyPhotos.propertyId, input.propertyId));
  if (existing.length >= MAX_PHOTOS_PER_PROPERTY) {
    throw ApplicationFailure.create({ type: "conflict", nonRetryable: true });
  }

  const [row] = await db
    .insert(schema.propertyPhotos)
    .values({
      propertyId: input.propertyId,
      ownerId: input.ownerId,
      storagePath: input.storagePath,
      caption: input.caption,
      sortOrder: existing.length,
    })
    .returning();
  return row;
}

export async function listPropertyPhotosActivity(input: { propertyId: string; ownerId: string }) {
  await assertOwnedProperty(input.propertyId, input.ownerId);

  const rows = await db
    .select()
    .from(schema.propertyPhotos)
    .where(eq(schema.propertyPhotos.propertyId, input.propertyId))
    .orderBy(asc(schema.propertyPhotos.sortOrder), asc(schema.propertyPhotos.createdAt));

  return Promise.all(
    rows.map(async (row) => ({ ...row, url: await presignDownload(row.storagePath) })),
  );
}

// Deletes the R2 object as well as the row. Unlike the documents routes (which
// orphan the object — see the NOTE in web's tenant actions), a photo has no
// audit value once removed and an orphaned image bills storage forever.
// Best-effort on the object: a failed delete must not leave the row behind,
// or the owner sees a photo they can't remove.
export async function deletePropertyPhotoActivity(input: { id: string; ownerId: string }) {
  const [row] = await db
    .delete(schema.propertyPhotos)
    .where(and(eq(schema.propertyPhotos.id, input.id), eq(schema.propertyPhotos.ownerId, input.ownerId)))
    .returning({ storagePath: schema.propertyPhotos.storagePath });
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });

  await deleteObject(row.storagePath).catch((err: unknown) => {
    console.log(`deletePropertyPhoto: object ${row.storagePath} not removed: ${String(err)}`);
  });
}

// Tenant-facing. This is the one place a caller reads an R2 key that is not
// under their own prefix and holds no claimed share for, so the authz check
// lives entirely here: the photo's property must have an OPEN listing. Close
// the listing and the photos stop being reachable — presignDownloadActivity's
// own prefix rule would reject these keys, and that is deliberate: this path
// must be the only way in.
export async function listListingPhotosActivity(input: { listingId: string }) {
  const rows = await db
    .select({
      id: schema.propertyPhotos.id,
      caption: schema.propertyPhotos.caption,
      storagePath: schema.propertyPhotos.storagePath,
      sortOrder: schema.propertyPhotos.sortOrder,
      createdAt: schema.propertyPhotos.createdAt,
    })
    .from(schema.propertyListings)
    .innerJoin(schema.propertyPhotos, eq(schema.propertyPhotos.propertyId, schema.propertyListings.propertyId))
    .where(and(eq(schema.propertyListings.id, input.listingId), eq(schema.propertyListings.status, "open")))
    .orderBy(asc(schema.propertyPhotos.sortOrder), asc(schema.propertyPhotos.createdAt));

  // storagePath is dropped from the response — a tenant gets the presigned URL
  // and never the raw key, so nothing here teaches them the owner's user id
  // (which is the key's first path segment).
  return Promise.all(
    rows.map(async ({ storagePath, ...photo }) => ({ ...photo, url: await presignDownload(storagePath) })),
  );
}
