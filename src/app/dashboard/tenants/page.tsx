import { createClient } from "@/lib/supabase/server";
import type { Tenant } from "@/lib/types";
import { addTenant } from "../actions";

const KYC_LABELS: Record<Tenant["kyc_status"], string> = {
  pending: "KYC pending",
  submitted: "KYC submitted",
  verified: "KYC verified",
};

export default async function TenantsPage() {
  const supabase = await createClient();
  const { data: tenants } = await supabase
    .from("tenants")
    .select("*")
    .order("full_name")
    .returns<Tenant[]>();

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tenants</h1>

      {tenants && tenants.length > 0 ? (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {tenants.map((tenant) => (
            <li key={tenant.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>
                <span className="font-medium text-zinc-900 dark:text-zinc-50">{tenant.full_name}</span>
                <span className="ml-3 text-zinc-500">
                  {[tenant.phone, tenant.email].filter(Boolean).join(" · ")}
                </span>
              </span>
              <span
                className={
                  tenant.kyc_status === "verified"
                    ? "text-emerald-600 dark:text-emerald-500"
                    : "text-amber-600"
                }
              >
                {KYC_LABELS[tenant.kyc_status]}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">No tenants yet — add one below.</p>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Add a tenant</h2>
        <form action={addTenant} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="full_name" label="Full name" required />
          <Field name="phone" label="Phone (WhatsApp)" placeholder="+91..." />
          <Field name="email" label="Email" />
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            KYC status
            <select
              name="kyc_status"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="pending">Pending</option>
              <option value="submitted">Submitted</option>
              <option value="verified">Verified</option>
            </select>
          </label>
          <Field name="notes" label="Notes" />
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
            >
              Add tenant
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function Field({
  name,
  label,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {label}
      <input
        name={name}
        placeholder={placeholder}
        required={required}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}
