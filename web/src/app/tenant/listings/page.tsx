import Link from "next/link";
import { formatInr } from "@/lib/currency";
import type { ApplicationMessage, OwnApplication, PublicListing } from "@/lib/types";
import { apiFetch } from "@/lib/api/client";
import { MessageThread } from "@/components/MessageThread";
import { sendApplicationMessage, submitListingApplication } from "../actions";

const STATUS_LABELS: Record<OwnApplication["status"], string> = {
  under_review: "Under review",
  kyc_requested: "KYC requested — check for a link from the owner",
  approved: "Approved",
  rejected: "Not selected",
  withdrawn: "Withdrawn",
};

const PROPERTY_TYPE_LABELS: Record<PublicListing["propertyType"], string> = {
  apartment: "Apartment / Flat",
  independent_house: "Independent house",
  villa: "Villa",
  plot: "Plot / Land",
  commercial: "Commercial",
};

type Filters = {
  state?: string;
  city?: string;
  pincode?: string;
  bedrooms?: string;
  min_rent?: string;
  max_rent?: string;
  min_lease_months?: string;
};

export default async function TenantListingsPage({ searchParams }: { searchParams: Promise<Filters> }) {
  const filters = await searchParams;

  const query = new URLSearchParams();
  if (filters.state) query.set("state", filters.state.trim());
  if (filters.city) query.set("city", filters.city.trim());
  if (filters.pincode) query.set("pincode", filters.pincode.trim());
  if (filters.bedrooms) query.set("bedrooms", filters.bedrooms);
  if (filters.min_rent) query.set("minRent", filters.min_rent);
  if (filters.max_rent) query.set("maxRent", filters.max_rent);
  if (filters.min_lease_months) query.set("minLeaseMonths", filters.min_lease_months);
  const qs = query.toString();

  const hasFilters = qs.length > 0;

  const [listings, applications] = await Promise.all([
    apiFetch(`/listings/browse${hasFilters ? `?${qs}` : ""}`) as Promise<PublicListing[]>,
    apiFetch("/applications") as Promise<OwnApplication[]>,
  ]);

  const activeApplicationByListing = new Map(
    (applications ?? [])
      .filter((a) => a.status === "under_review" || a.status === "kyc_requested")
      .map((a) => [a.listingId, a]),
  );

  const messagesByApplication = new Map(
    await Promise.all(
      (applications ?? []).map(
        async (a) => [a.id, (await apiFetch(`/applications/${a.id}/messages`)) as ApplicationMessage[]] as const,
      ),
    ),
  );

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Browse listings</h1>

      <form
        method="get"
        className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          State
          <input
            name="state"
            defaultValue={filters.state ?? ""}
            placeholder="e.g. Karnataka"
            className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          City
          <input
            name="city"
            defaultValue={filters.city ?? ""}
            placeholder="e.g. Bengaluru"
            className="w-32 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          PIN code
          <input
            name="pincode"
            defaultValue={filters.pincode ?? ""}
            placeholder="e.g. 560095"
            className="w-28 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Bedrooms (BHK)
          <input
            name="bedrooms"
            type="number"
            min="1"
            step="1"
            defaultValue={filters.bedrooms ?? ""}
            className="w-24 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Min rent (₹)
          <input
            name="min_rent"
            type="number"
            min="0"
            step="1"
            defaultValue={filters.min_rent ?? ""}
            className="w-28 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Max rent (₹)
          <input
            name="max_rent"
            type="number"
            min="0"
            step="1"
            defaultValue={filters.max_rent ?? ""}
            className="w-28 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Lease tenure (months)
          <input
            name="min_lease_months"
            type="number"
            min="1"
            step="1"
            defaultValue={filters.min_lease_months ?? ""}
            placeholder="you can commit to"
            className="w-36 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal placeholder:text-xs dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
        >
          Filter
        </button>
        {hasFilters && (
          <a href="/tenant/listings" className="text-sm text-zinc-500 underline hover:text-zinc-900 dark:hover:text-zinc-50">
            Clear
          </a>
        )}
      </form>

      {listings && listings.length > 0 ? (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {listings.map((listing) => {
            const activeApplication = activeApplicationByListing.get(listing.id);
            return (
              <li
                key={listing.id}
                className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
              >
                {listing.coverPhotoUrl ? (
                  <Link href={`/tenant/listings/${listing.id}/photos`} className="relative block">
                    {/* Plain <img>, not next/image — the src is a presigned R2
                        URL that expires in ~10 minutes, so it must not be run
                        through (or cached by) the image optimizer. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={listing.coverPhotoUrl}
                      alt={listing.title}
                      className="aspect-4/3 w-full object-cover"
                    />
                    {listing.photoCount > 1 && (
                      <span className="absolute bottom-2 right-2 rounded-full bg-zinc-900/80 px-2.5 py-1 text-xs font-medium text-white">
                        +{listing.photoCount - 1} more
                      </span>
                    )}
                  </Link>
                ) : (
                  // Keeps the cards in a row the same height whether or not the
                  // owner uploaded anything, rather than letting a photo-less
                  // listing collapse next to one with a picture.
                  <div className="flex aspect-4/3 w-full items-center justify-center bg-zinc-100 text-sm text-zinc-400 dark:bg-zinc-900">
                    No photos yet
                  </div>
                )}

                <div className="p-6">
                <div className="flex items-start justify-between">
                  <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{listing.title}</h2>
                  <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs capitalize text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                    {listing.bedrooms ? `${listing.bedrooms}BHK · ` : ""}
                    {PROPERTY_TYPE_LABELS[listing.propertyType]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-zinc-500">
                  {listing.city}, {listing.state} · {listing.pincode}
                </p>
                <p className="mt-3 text-sm font-medium text-zinc-900 dark:text-zinc-50">
                  {formatInr(Number(listing.baseRentAsk))} / month asking
                </p>
                {listing.minLeaseMonths && (
                  <p className="text-xs text-zinc-500">{listing.minLeaseMonths} month min. lease</p>
                )}

                {activeApplication ? (
                  <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-500">
                    Applied — {STATUS_LABELS[activeApplication.status]}
                  </p>
                ) : (
                  <form action={submitListingApplication} className="mt-4 flex flex-col gap-3">
                    <input type="hidden" name="listing_id" value={listing.id} />
                    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Your proposed rent (₹ / month)
                      <input
                        name="proposed_rent"
                        type="number"
                        min="1"
                        step="1"
                        required
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Move-in date
                      <input
                        name="move_in_date"
                        type="date"
                        required
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      Monthly income (₹, optional)
                      <input
                        name="monthly_income"
                        type="number"
                        min="0"
                        step="1"
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      A few lines about yourself (optional)
                      <textarea
                        name="profile_highlights"
                        rows={2}
                        maxLength={2000}
                        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
                      />
                    </label>
                    <button
                      type="submit"
                      className="self-start rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
                    >
                      Apply
                    </button>
                  </form>
                )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No open listings right now — check back later.</p>
      )}

      {applications && applications.length > 0 && (
        <section>
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">My applications</h2>
          <ul className="flex flex-col gap-3">
            {applications.map((application) => (
              <li
                key={application.id}
                className="rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex items-center justify-between">
                  <span>
                    <span className="font-medium text-zinc-900 dark:text-zinc-50">
                      {application.propertyNickname}
                    </span>
                    <span className="ml-3 text-zinc-500">
                      {formatInr(Number(application.proposedRent))} / month · {application.propertyCity}
                    </span>
                  </span>
                  <span
                    className={
                      application.status === "approved"
                        ? "text-emerald-600 dark:text-emerald-500"
                        : application.status === "rejected" || application.status === "withdrawn"
                          ? "text-zinc-400"
                          : "text-amber-600"
                    }
                  >
                    {STATUS_LABELS[application.status]}
                  </span>
                </div>
                <div className="mt-3">
                  <MessageThread
                    applicationId={application.id}
                    messages={messagesByApplication.get(application.id) ?? []}
                    viewerRole="tenant"
                    counterpartyName="Owner"
                    sendAction={sendApplicationMessage}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
