import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatApprox, formatInr, getRateFromInr } from "@/lib/currency";
import type { Lease, PayLink, Profile, Property, RentPayment, Tenant } from "@/lib/types";
import { recordPayment } from "../actions";
import { WhatsAppPayButton } from "./whatsapp-button";

export default async function RentPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  const [
    { data: profile },
    { data: leases },
    { data: properties },
    { data: tenants },
    { data: payments },
    { data: payLinks },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profile>(),
    supabase.from("leases").select("*").eq("status", "active").returns<Lease[]>(),
    supabase.from("properties").select("*").returns<Property[]>(),
    supabase.from("tenants").select("*").returns<Tenant[]>(),
    supabase
      .from("rent_payments")
      .select("*")
      .eq("period_year", year)
      .eq("period_month", month)
      .returns<RentPayment[]>(),
    supabase
      .from("pay_links")
      .select("*")
      .eq("period_year", year)
      .eq("period_month", month)
      .returns<PayLink[]>(),
  ]);

  const currency = profile?.preferred_currency ?? "USD";
  const rate = await getRateFromInr(currency);

  const propertyById = new Map((properties ?? []).map((p) => [p.id, p]));
  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]));
  const paymentByLease = new Map((payments ?? []).map((p) => [p.lease_id, p]));
  const payLinkByLease = new Map((payLinks ?? []).map((p) => [p.lease_id, p]));

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Rent — {monthLabel}</h1>
        <p className="text-sm text-zinc-500">
          Home-currency figures are approximate ({currency}, ECB reference rate).
        </p>
        {!profile?.upi_vpa && (
          <p className="mt-2 text-sm text-amber-700 dark:text-amber-500">
            Add your UPI ID in{" "}
            <Link href="/dashboard/settings" className="underline">
              Settings
            </Link>{" "}
            and WhatsApp reminders will include a pay link that opens the tenant&apos;s UPI app with
            your details filled in.
          </p>
        )}
      </div>

      {(leases?.length ?? 0) === 0 ? (
        <p className="text-sm text-zinc-500">
          No active leases. Create one from a property&apos;s page first.
        </p>
      ) : (
        <ul className="flex flex-col gap-4">
          {(leases ?? []).map((lease) => {
            const property = propertyById.get(lease.property_id);
            const tenant = tenantById.get(lease.tenant_id);
            const payment = paymentByLease.get(lease.id);
            const payLink = payLinkByLease.get(lease.id);
            const rent = Number(lease.rent_amount);
            const overdue = !payment && now.getDate() > lease.rent_due_day;

            return (
              <li
                key={lease.id}
                className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
                      {property?.nickname ?? "Property"}
                    </h2>
                    <p className="text-sm text-zinc-500">
                      {tenant?.full_name ?? "Tenant"} · {formatInr(rent)}
                      {rate != null && (
                        <span className="ml-1">{formatApprox(rent, currency, rate)}</span>
                      )}{" "}
                      · due day {lease.rent_due_day}
                    </p>
                  </div>
                  <span
                    className={
                      payment?.status === "paid"
                        ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400"
                        : payment?.status === "partial"
                          ? "rounded-full bg-amber-100 px-3 py-1 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                          : overdue
                            ? "rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700 dark:bg-red-950 dark:text-red-400"
                            : "rounded-full bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400"
                    }
                  >
                    {payment?.status === "paid"
                      ? `Paid ${payment.paid_on ?? ""}`
                      : payment?.status === "partial"
                        ? `Partial: ${formatInr(Number(payment.amount_paid ?? 0))}`
                        : overdue
                          ? "Overdue"
                          : "Due"}
                  </span>
                </div>

                {payment?.status !== "paid" && payLink && (
                  <p className="mt-2 text-xs text-zinc-500">
                    Pay link sent
                    {payLink.opened_at && " · opened by tenant ✓"}
                    {payLink.claimed_paid_at && (
                      <span className="font-medium text-emerald-600 dark:text-emerald-500">
                        {" "}
                        · tenant says they&apos;ve paid ✓ — confirm below once it reaches your
                        account
                      </span>
                    )}
                  </p>
                )}

                {payment?.status !== "paid" && (
                  <div className="mt-4 flex flex-wrap items-end gap-4">
                    <form action={recordPayment} className="flex flex-wrap items-end gap-3">
                      <input type="hidden" name="lease_id" value={lease.id} />
                      <input type="hidden" name="period_year" value={year} />
                      <input type="hidden" name="period_month" value={month} />
                      <input type="hidden" name="amount_due" value={rent} />
                      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Amount received (INR)
                        <input
                          name="amount_paid"
                          type="number"
                          min={0}
                          defaultValue={rent}
                          required
                          className="w-36 rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Received on
                        <input
                          name="paid_on"
                          type="date"
                          defaultValue={now.toISOString().slice(0, 10)}
                          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
                        />
                      </label>
                      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                        Method
                        <select
                          name="method"
                          defaultValue={payLink?.claimed_paid_at ? "upi" : "bank_transfer"}
                          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
                        >
                          <option value="bank_transfer">Bank transfer (NRO/NRE)</option>
                          <option value="upi">UPI</option>
                          <option value="cash">Cash (via family/caretaker)</option>
                          <option value="other">Other</option>
                        </select>
                      </label>
                      <button
                        type="submit"
                        className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
                      >
                        Mark received
                      </button>
                    </form>

                    {tenant?.phone && (
                      <WhatsAppPayButton
                        label={profile?.upi_vpa ? "WhatsApp pay link" : "WhatsApp reminder"}
                        leaseId={lease.id}
                        periodYear={year}
                        periodMonth={month}
                        amount={rent}
                        phone={tenant.phone}
                        tenantName={tenant.full_name}
                        propertyNickname={property?.nickname ?? "the property"}
                        monthLabel={monthLabel}
                      />
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
