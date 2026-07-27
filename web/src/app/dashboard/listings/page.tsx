import Link from "next/link";
import { apiFetch } from "@/lib/api/client";
import { formatInr } from "@/lib/currency";
import type { Property, PropertyListing } from "@/lib/types";
import { openListing } from "../actions";

export default async function ListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string }>;
}) {
  const { propertyId: requestedPropertyId } = await searchParams;

  const [listings, properties] = await Promise.all([
    apiFetch("/listings") as Promise<PropertyListing[]>,
    apiFetch("/properties") as Promise<Property[]>,
  ]);

  const propertyById = new Map((properties ?? []).map((p) => [p.id, p]));
  const openPropertyIds = new Set((listings ?? []).filter((l) => l.status === "open").map((l) => l.propertyId));
  const availableProperties = (properties ?? []).filter((p) => !openPropertyIds.has(p.id));
  const preselectedPropertyId =
    requestedPropertyId && availableProperties.some((p) => p.id === requestedPropertyId)
      ? requestedPropertyId
      : undefined;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Marketplace</h1>

      {listings && listings.length > 0 ? (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {listings.map((listing) => {
            const property = propertyById.get(listing.propertyId);
            return (
              <li key={listing.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>
                  <Link
                    href={`/dashboard/listings/${listing.id}`}
                    className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-50"
                  >
                    {property?.nickname ?? "Property"}
                  </Link>
                  <span className="ml-3 text-zinc-500">
                    Asking {formatInr(Number(listing.baseRentAsk))} / month
                  </span>
                </span>
                <span
                  className={
                    listing.status === "open"
                      ? "text-emerald-600 dark:text-emerald-500"
                      : "text-zinc-400"
                  }
                >
                  {listing.status === "open" ? "Open" : "Closed"}
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No listings yet — open one below to start taking applications.</p>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Open a listing</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Invite competing applications from tenant accounts on RentVault. A property can have one open
          listing at a time.
        </p>
        {availableProperties.length > 0 ? (
          <form action={openListing} className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Property
              <select
                name="property_id"
                required
                defaultValue={preselectedPropertyId}
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
              >
                {availableProperties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nickname}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Asking rent (₹ / month)
              <input
                name="base_rent_ask"
                type="number"
                min="1"
                step="1"
                required
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Min. lease (months, optional)
              <input
                name="min_lease_months"
                type="number"
                min="1"
                step="1"
                className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
              />
            </label>
            <button
              type="submit"
              className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
            >
              Open listing
            </button>
          </form>
        ) : (
          <p className="text-sm text-zinc-500">
            Every property either has an open listing already or you haven&apos;t added one yet — see{" "}
            <Link href="/dashboard/properties" className="underline">
              Properties
            </Link>
            .
          </p>
        )}
      </section>
    </div>
  );
}
