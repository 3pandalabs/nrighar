import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api/client";
import { formatInr } from "@/lib/currency";
import type { Lease, Property, PropertyListing, PropertyPhoto, RentPayment, Tenant } from "@/lib/types";
import { addLease, deletePropertyPhoto, endLease } from "../../actions";
import { PropertyPhotoUpload } from "./photo-upload";

// Mirrors MAX_PHOTOS_PER_PROPERTY in api/src/temporal/activities/propertyPhotos.ts.
// The API is the real limit — this only stops the UI offering an upload that
// would come back 409.
const MAX_PHOTOS = 20;

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let property: Property;
  try {
    property = await apiFetch(`/properties/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const [tenants, allLeases, allPayments, allListings, photos] = await Promise.all([
    apiFetch("/tenants") as Promise<Tenant[]>,
    apiFetch("/leases") as Promise<Lease[]>,
    apiFetch("/rent-payments") as Promise<RentPayment[]>,
    apiFetch("/listings") as Promise<PropertyListing[]>,
    apiFetch(`/properties/${id}/photos`) as Promise<PropertyPhoto[]>,
  ]);

  // Every other list on this page is normalised the same way — apiFetch hands
  // back whatever the API sent, and an empty 204 would otherwise be null here.
  const propertyPhotos = photos ?? [];

  const openListing = (allListings ?? []).find((l) => l.propertyId === id && l.status === "open");

  const leases = (allLeases ?? [])
    .filter((l) => l.propertyId === id)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  const activeLease = leases.find((l) => l.status === "active");
  const pastLeases = leases.filter((l) => l.status === "ended");
  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]));

  const leaseIds = new Set(leases.map((l) => l.id));
  const allPaymentsForProperty = (allPayments ?? [])
    .filter((p) => leaseIds.has(p.leaseId))
    .sort((a, b) => b.periodYear - a.periodYear || b.periodMonth - a.periodMonth);

  const paymentsByLease = new Map<string, RentPayment[]>();
  for (const p of allPaymentsForProperty) {
    const list = paymentsByLease.get(p.leaseId) ?? [];
    list.push(p);
    paymentsByLease.set(p.leaseId, list);
  }
  const payments = activeLease ? (paymentsByLease.get(activeLease.id) ?? []).slice(0, 12) : [];

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/dashboard/properties" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50">
          &larr; All properties
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
          {property.nickname}
        </h1>
        <p className="text-sm text-zinc-500">
          {property.addressLine1}
          {property.addressLine2 ? `, ${property.addressLine2}` : ""}, {property.city},{" "}
          {property.state} {property.pincode}
        </p>
        {property.notes && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{property.notes}</p>}
      </div>

      {openListing ? (
        <div className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm dark:border-emerald-900 dark:bg-emerald-950">
          <span className="text-emerald-800 dark:text-emerald-300">
            Listed on the marketplace at {formatInr(Number(openListing.baseRentAsk))} / month — tenants can find and
            apply to it.
          </span>
          <Link href={`/dashboard/listings/${openListing.id}`} className="shrink-0 font-medium underline">
            View applications
          </Link>
        </div>
      ) : (
        <div className="flex items-center justify-between rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm dark:border-amber-900 dark:bg-amber-950">
          <span className="text-amber-800 dark:text-amber-300">
            Not listed on the marketplace yet — tenants can&apos;t find or apply to it until you open a listing.
          </span>
          <Link href={`/dashboard/listings?propertyId=${property.id}`} className="shrink-0 font-medium underline">
            Open a listing
          </Link>
        </div>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mb-1 flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Photos</h2>
          <span className="text-sm text-zinc-500">
            {propertyPhotos.length} of {MAX_PHOTOS}
          </span>
        </div>
        <p className="mb-4 text-sm text-zinc-500">
          The first photo is the one tenants see on the marketplace card. Photos are only visible while this property
          has an open listing.
        </p>

        <PropertyPhotoUpload propertyId={property.id} disabled={propertyPhotos.length >= MAX_PHOTOS} />

        {propertyPhotos.length > 0 && (
          <ul className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {propertyPhotos.map((photo, index) => (
              <li key={photo.id} className="group relative overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-800">
                {/* Plain <img>, not next/image: the src is a presigned R2 URL
                    that changes every request and expires in ~10 minutes, so
                    the image optimizer would cache a URL that's already dead
                    and thrash its cache on every page view. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={photo.url}
                  alt={photo.caption ?? `${property.nickname} photo ${index + 1}`}
                  className="aspect-4/3 w-full object-cover"
                />
                {index === 0 && (
                  <span className="absolute left-2 top-2 rounded-full bg-zinc-900/80 px-2 py-0.5 text-xs font-medium text-white">
                    Cover
                  </span>
                )}
                <form action={deletePropertyPhoto} className="absolute right-2 top-2">
                  <input type="hidden" name="property_id" value={property.id} />
                  <input type="hidden" name="photo_id" value={photo.id} />
                  <button
                    type="submit"
                    aria-label="Remove photo"
                    className="rounded-full bg-zinc-900/80 px-2 py-0.5 text-xs font-medium text-white opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                  >
                    Remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Current lease</h2>
        {activeLease ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <span className="text-zinc-500">Tenant:</span>{" "}
              {tenantById.get(activeLease.tenantId)?.fullName ?? "Unknown"}
            </p>
            <p>
              <span className="text-zinc-500">Rent:</span> {formatInr(Number(activeLease.rentAmount))} / month,
              due on day {activeLease.rentDueDay}
            </p>
            {activeLease.depositAmount != null && (
              <p>
                <span className="text-zinc-500">Deposit:</span> {formatInr(Number(activeLease.depositAmount))}
              </p>
            )}
            <p>
              <span className="text-zinc-500">Since:</span> {activeLease.startDate}
            </p>
            <form action={endLease} className="mt-3">
              <input type="hidden" name="lease_id" value={activeLease.id} />
              <button
                type="submit"
                className="rounded-full border border-red-300 px-4 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950"
              >
                End lease
              </button>
            </form>
          </div>
        ) : (
          <div>
            <p className="mb-4 text-sm text-zinc-500">
              Vacant.{" "}
              {(tenants?.length ?? 0) === 0 && (
                <>
                  First{" "}
                  <Link href="/dashboard/tenants" className="underline">
                    add a tenant
                  </Link>
                  , then create the lease here.
                </>
              )}
            </p>
            {(tenants?.length ?? 0) > 0 && (
              <form action={addLease} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <input type="hidden" name="property_id" value={property.id} />
                <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  Tenant
                  <select
                    name="tenant_id"
                    required
                    className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
                  >
                    {(tenants ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.fullName}
                      </option>
                    ))}
                  </select>
                </label>
                <LeaseField name="rent_amount" label="Monthly rent (INR)" type="number" required />
                <LeaseField name="deposit_amount" label="Deposit (INR)" type="number" />
                <LeaseField name="rent_due_day" label="Rent due day (1-28)" type="number" required />
                <LeaseField name="start_date" label="Start date" type="date" required />
                <LeaseField name="end_date" label="End date (optional)" type="date" />
                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
                  >
                    Create lease
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </section>

      {pastLeases.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Past leases
          </h2>
          <ul className="flex flex-col gap-3">
            {pastLeases.map((pl) => {
              const plPayments = paymentsByLease.get(pl.id) ?? [];
              const collected = plPayments.reduce((sum, p) => sum + Number(p.amountPaid ?? 0), 0);
              return (
                <li
                  key={pl.id}
                  className="rounded-2xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950"
                >
                  <details>
                    <summary className="cursor-pointer text-sm">
                      <span className="font-medium text-zinc-900 dark:text-zinc-50">
                        {tenantById.get(pl.tenantId)?.fullName ?? "Unknown tenant"}
                      </span>{" "}
                      <span className="text-zinc-500">
                        · {pl.startDate} → {pl.endDate ?? "?"} · {formatInr(Number(pl.rentAmount))}
                        /month · {plPayments.length} payment{plPayments.length === 1 ? "" : "s"}{" "}
                        recorded ({formatInr(collected)} collected)
                      </span>
                    </summary>
                    {plPayments.length > 0 ? (
                      <ul className="mt-3 divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                        {plPayments.map((p) => (
                          <li
                            key={p.id}
                            className="flex items-center justify-between py-2 text-sm"
                          >
                            <span>
                              {new Date(p.periodYear, p.periodMonth - 1).toLocaleString("en-US", {
                                month: "long",
                                year: "numeric",
                              })}
                            </span>
                            <span className="flex items-center gap-3">
                              <span>{formatInr(Number(p.amountPaid ?? 0))}</span>
                              <span
                                className={
                                  p.status === "paid"
                                    ? "text-emerald-600 dark:text-emerald-500"
                                    : "text-amber-600"
                                }
                              >
                                {p.status}
                              </span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-3 border-t border-zinc-200 pt-3 text-sm text-zinc-500 dark:border-zinc-800">
                        No payments were recorded for this lease.
                      </p>
                    )}
                  </details>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {activeLease && (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Payment history
          </h2>
          {payments && payments.length > 0 ? (
            <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span>
                    {new Date(p.periodYear, p.periodMonth - 1).toLocaleString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-3">
                    <span>{formatInr(Number(p.amountPaid ?? 0))}</span>
                    <span
                      className={
                        p.status === "paid" ? "text-emerald-600 dark:text-emerald-500" : "text-amber-600"
                      }
                    >
                      {p.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-zinc-500">
              No payments recorded yet — record them from the{" "}
              <Link href="/dashboard/rent" className="underline">
                Rent
              </Link>{" "}
              page.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function LeaseField({
  name,
  label,
  type,
  required,
}: {
  name: string;
  label: string;
  type: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        min={type === "number" ? 0 : undefined}
        max={name === "rent_due_day" ? 28 : undefined}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}
