import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatInr } from "@/lib/currency";
import type { Lease, Property, RentPayment, Tenant } from "@/lib/types";
import { addLease, endLease } from "../../actions";

export default async function PropertyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: property }, { data: tenants }, { data: leases }] = await Promise.all([
    supabase.from("properties").select("*").eq("id", id).maybeSingle<Property>(),
    supabase.from("tenants").select("*").order("full_name").returns<Tenant[]>(),
    supabase
      .from("leases")
      .select("*")
      .eq("property_id", id)
      .order("created_at", { ascending: false })
      .returns<Lease[]>(),
  ]);

  if (!property) {
    notFound();
  }

  const activeLease = (leases ?? []).find((l) => l.status === "active");
  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]));

  const { data: payments } = activeLease
    ? await supabase
        .from("rent_payments")
        .select("*")
        .eq("lease_id", activeLease.id)
        .order("period_year", { ascending: false })
        .order("period_month", { ascending: false })
        .limit(12)
        .returns<RentPayment[]>()
    : { data: [] as RentPayment[] };

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
          {property.address_line1}
          {property.address_line2 ? `, ${property.address_line2}` : ""}, {property.city},{" "}
          {property.state} {property.pincode}
        </p>
        {property.notes && <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">{property.notes}</p>}
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Current lease</h2>
        {activeLease ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <span className="text-zinc-500">Tenant:</span>{" "}
              {tenantById.get(activeLease.tenant_id)?.full_name ?? "Unknown"}
            </p>
            <p>
              <span className="text-zinc-500">Rent:</span> {formatInr(Number(activeLease.rent_amount))} / month,
              due on day {activeLease.rent_due_day}
            </p>
            {activeLease.deposit_amount != null && (
              <p>
                <span className="text-zinc-500">Deposit:</span> {formatInr(Number(activeLease.deposit_amount))}
              </p>
            )}
            <p>
              <span className="text-zinc-500">Since:</span> {activeLease.start_date}
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
                        {t.full_name}
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
                    {new Date(p.period_year, p.period_month - 1).toLocaleString("en-US", {
                      month: "long",
                      year: "numeric",
                    })}
                  </span>
                  <span className="flex items-center gap-3">
                    <span>{formatInr(Number(p.amount_paid ?? 0))}</span>
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
