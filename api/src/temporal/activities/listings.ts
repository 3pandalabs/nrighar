import { and, asc, desc, eq, gte, ilike, inArray, isNull, lte, or } from "drizzle-orm";
import { ApplicationFailure } from "@temporalio/common";
import { db, schema } from "../../db/index.js";
import { isUniqueViolation } from "../../lib/isUniqueViolation.js";
import { presignDownload } from "../../plugins/r2.js";

export async function createListing(input: {
  ownerId: string;
  propertyId: string;
  baseRentAsk: number;
  minLeaseMonths?: number;
}) {
  const [property] = await db
    .select({ id: schema.properties.id })
    .from(schema.properties)
    .where(and(eq(schema.properties.id, input.propertyId), eq(schema.properties.ownerId, input.ownerId)));
  if (!property) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });

  try {
    const [row] = await db
      .insert(schema.propertyListings)
      .values({
        ownerId: input.ownerId,
        propertyId: input.propertyId,
        baseRentAsk: String(input.baseRentAsk),
        minLeaseMonths: input.minLeaseMonths,
      })
      .returning();
    return row;
  } catch (err) {
    if (isUniqueViolation(err)) throw ApplicationFailure.create({ type: "conflict", nonRetryable: true });
    throw err;
  }
}

export async function listOwnListings(input: { ownerId: string }) {
  return db
    .select()
    .from(schema.propertyListings)
    .where(eq(schema.propertyListings.ownerId, input.ownerId))
    .orderBy(desc(schema.propertyListings.createdAt));
}

// Public-safe fields only — no ownerId, addressLine1, or notes. pincode is
// exposed (it's a postal-area code, not a street address) since it's the
// primary location filter; anyone browsing still can't learn a specific
// unit's address before applying. Every filter is optional and AND'd
// together — see routes/listings.ts for the exact semantics of each.
//
// coverPhotoUrl is a presigned R2 URL for the property's first photo, or null
// when it has none. Presigning is a local HMAC with no network round-trip, so
// doing it for every row on the page is cheap — but the URLs expire (10 min,
// see plugins/r2.ts), which is why they're minted per request rather than
// stored. The raw storage key never leaves the server: it starts with the
// owner's user id.
export async function browseOpenListings(input: {
  state?: string;
  city?: string;
  pincode?: string;
  bedrooms?: number;
  minRent?: number;
  maxRent?: number;
  minLeaseMonths?: number;
}) {
  const listings = await db
    .select({
      id: schema.propertyListings.id,
      propertyId: schema.propertyListings.propertyId,
      baseRentAsk: schema.propertyListings.baseRentAsk,
      minLeaseMonths: schema.propertyListings.minLeaseMonths,
      createdAt: schema.propertyListings.createdAt,
      title: schema.properties.nickname,
      city: schema.properties.city,
      state: schema.properties.state,
      pincode: schema.properties.pincode,
      propertyType: schema.properties.propertyType,
      bedrooms: schema.properties.bedrooms,
    })
    .from(schema.propertyListings)
    .innerJoin(schema.properties, eq(schema.properties.id, schema.propertyListings.propertyId))
    .where(
      and(
        eq(schema.propertyListings.status, "open"),
        input.state ? ilike(schema.properties.state, input.state) : undefined,
        input.city ? ilike(schema.properties.city, input.city) : undefined,
        input.pincode ? eq(schema.properties.pincode, input.pincode) : undefined,
        input.bedrooms !== undefined ? eq(schema.properties.bedrooms, input.bedrooms) : undefined,
        input.minRent !== undefined ? gte(schema.propertyListings.baseRentAsk, String(input.minRent)) : undefined,
        input.maxRent !== undefined ? lte(schema.propertyListings.baseRentAsk, String(input.maxRent)) : undefined,
        // A tenant asking for a 12-month min still wants to see a listing
        // that's fine with as little as 6 — only exclude listings whose
        // stated minimum exceeds what the tenant is willing to commit to.
        // A listing with no stated minimum (null) always passes.
        input.minLeaseMonths !== undefined
          ? or(isNull(schema.propertyListings.minLeaseMonths), lte(schema.propertyListings.minLeaseMonths, input.minLeaseMonths))
          : undefined,
      ),
    )
    .orderBy(desc(schema.propertyListings.createdAt));

  if (listings.length === 0) return [];

  // One extra query for every photo on the page, then the cover is picked in
  // memory — rather than a correlated subquery or a lateral join per listing.
  // The result set here is already bounded by the filters above and photos are
  // capped per property, so this stays a single indexed range scan.
  const photos = await db
    .select({
      propertyId: schema.propertyPhotos.propertyId,
      storagePath: schema.propertyPhotos.storagePath,
    })
    .from(schema.propertyPhotos)
    .where(inArray(schema.propertyPhotos.propertyId, listings.map((l) => l.propertyId)))
    .orderBy(asc(schema.propertyPhotos.sortOrder), asc(schema.propertyPhotos.createdAt));

  const coverByProperty = new Map<string, string>();
  const countByProperty = new Map<string, number>();
  for (const photo of photos) {
    // First row per property wins — the ORDER BY above already put the lowest
    // sortOrder first.
    if (!coverByProperty.has(photo.propertyId)) coverByProperty.set(photo.propertyId, photo.storagePath);
    countByProperty.set(photo.propertyId, (countByProperty.get(photo.propertyId) ?? 0) + 1);
  }

  return Promise.all(
    listings.map(async ({ propertyId, ...listing }) => {
      const coverKey = coverByProperty.get(propertyId);
      return {
        ...listing,
        // photoCount lets the client show a "+3 more" affordance without
        // fetching the whole gallery it may never open.
        photoCount: countByProperty.get(propertyId) ?? 0,
        coverPhotoUrl: coverKey ? await presignDownload(coverKey) : null,
      };
    }),
  );
}

export async function closeListing(input: { id: string; ownerId: string }) {
  const [row] = await db
    .update(schema.propertyListings)
    .set({ status: "closed", closedAt: new Date() })
    .where(and(eq(schema.propertyListings.id, input.id), eq(schema.propertyListings.ownerId, input.ownerId)))
    .returning();
  if (!row) throw ApplicationFailure.create({ type: "not_found", nonRetryable: true });
  return row;
}
