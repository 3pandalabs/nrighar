import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { requireAuth, requireTenantRole } from "../auth/plugin.js";
import { sendWorkflow } from "../temporal/runWorkflow.js";

const createBody = z.object({
  propertyId: z.string().uuid(),
  baseRentAsk: z.number().positive(),
  minLeaseMonths: z.number().int().positive().optional(),
});

// Owner-side listing management (implicit owner scope, same pattern as
// properties.ts/tenants.ts) plus a tenant-facing browse endpoint. Applying
// to a listing is POST /listings/:id/applications — see routes/applications.ts.
export async function listingRoutes(app: FastifyInstance) {
  app.get("/listings", { preHandler: requireAuth }, async (req, reply) => {
    return sendWorkflow(reply, "listOwnListingsWorkflow", [{ ownerId: req.userId! }]);
  });

  app.post("/listings", { preHandler: requireAuth, schema: { body: createBody } }, async (req, reply) => {
    const body = req.body as z.infer<typeof createBody>;
    return sendWorkflow(
      reply,
      "createListingWorkflow",
      [{ ownerId: req.userId!, ...body }],
      201,
    );
  });

  app.patch("/listings/:id", { preHandler: requireAuth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "closeListingWorkflow", [{ id, ownerId: req.userId! }]);
  });

  // Every filter is optional and additive (AND'd together). pincode is an
  // exact match (Indian PIN codes are precise area identifiers, a prefix
  // match would be a different, fuzzier feature); state/city are
  // case-insensitive exact matches (free-text fields owners typed in, so
  // "Bengaluru" vs "bengaluru" shouldn't matter — still not a substring
  // search); bedrooms is exact; minRent/maxRent bound baseRentAsk;
  // minLeaseMonths matches listings whose own minLeaseMonths is <= the
  // tenant's requested value (a tenant willing to commit to 12 months
  // should still see a listing asking for only 6).
  app.get("/listings/browse", { preHandler: [requireAuth, requireTenantRole] }, async (req, reply) => {
    const { state, city, pincode, bedrooms, minRent, maxRent, minLeaseMonths } = req.query as {
      state?: string;
      city?: string;
      pincode?: string;
      bedrooms?: string;
      minRent?: string;
      maxRent?: string;
      minLeaseMonths?: string;
    };
    return sendWorkflow(reply, "browseOpenListingsWorkflow", [
      {
        state: state || undefined,
        city: city || undefined,
        pincode: pincode || undefined,
        bedrooms: bedrooms ? Number(bedrooms) : undefined,
        minRent: minRent ? Number(minRent) : undefined,
        maxRent: maxRent ? Number(maxRent) : undefined,
        minLeaseMonths: minLeaseMonths ? Number(minLeaseMonths) : undefined,
      },
    ]);
  });

  // Full photo gallery for one listing. Tenant-only, and the activity serves
  // photos only while the listing is still open — the browse response already
  // carries a single presigned cover photo per listing, so this is the
  // "see all photos" step, not the list view's data source.
  app.get("/listings/:id/photos", { preHandler: [requireAuth, requireTenantRole] }, async (req, reply) => {
    const { id } = req.params as { id: string };
    return sendWorkflow(reply, "listListingPhotosWorkflow", [{ listingId: id }]);
  });
}
