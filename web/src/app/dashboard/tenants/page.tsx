import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { IntakeLink, Property, Tenant } from "@/lib/types";
import { addTenant, createIntakeLink, deleteIntakeLink } from "../actions";
import { InviteLinkActions } from "./invite-link";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nrighar.3pandalabs.com";

const KYC_LABELS: Record<Tenant["kyc_status"], string> = {
  pending: "KYC pending",
  submitted: "KYC submitted",
  verified: "KYC verified",
};

export default async function TenantsPage() {
  const supabase = await createClient();
  const [{ data: tenants }, { data: properties }, { data: intakeLinks }] = await Promise.all([
    supabase.from("tenants").select("*").order("full_name").returns<Tenant[]>(),
    supabase.from("properties").select("*").order("nickname").returns<Property[]>(),
    supabase
      .from("intake_links")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<IntakeLink[]>(),
  ]);

  const propertyById = new Map((properties ?? []).map((p) => [p.id, p]));
  const tenantById = new Map((tenants ?? []).map((t) => [t.id, t]));

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Tenants</h1>

      {tenants && tenants.length > 0 ? (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {tenants.map((tenant) => (
            <li key={tenant.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <span>
                <Link
                  href={`/dashboard/tenants/${tenant.id}`}
                  className="font-medium text-zinc-900 underline-offset-2 hover:underline dark:text-zinc-50"
                >
                  {tenant.full_name}
                </Link>
                {tenant.tenant_user_id && (
                  <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
                    profile linked
                  </span>
                )}
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
        <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Invite a tenant
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Generate a link the tenant opens on their phone — they fill in their own details and
          upload KYC documents, which land here for your review.
        </p>
        <form action={createIntakeLink} className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Property (optional)
            <select
              name="property_id"
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
            >
              <option value="">None</option>
              {(properties ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
          >
            Create invite link
          </button>
        </form>

        {(intakeLinks?.length ?? 0) > 0 && (
          <ul className="mt-4 divide-y divide-zinc-200 border-t border-zinc-200 pt-1 dark:divide-zinc-800 dark:border-zinc-800">
            {(intakeLinks ?? []).map((link) => {
              const property = link.property_id ? propertyById.get(link.property_id) : undefined;
              const tenant = link.tenant_id ? tenantById.get(link.tenant_id) : undefined;
              const expired = link.status === "pending" && new Date(link.expires_at) < new Date();
              return (
                <li key={link.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <span className="text-sm">
                    {link.status === "submitted" ? (
                      <span className="text-emerald-600 dark:text-emerald-500">
                        ✓ Submitted{tenant ? ` by ${tenant.full_name}` : ""} — review their
                        documents in the vault
                      </span>
                    ) : (
                      <span className={expired ? "text-zinc-400" : "text-zinc-600 dark:text-zinc-400"}>
                        {expired ? "Expired invite" : "Pending invite"}
                        {property ? ` · ${property.nickname}` : ""} · created{" "}
                        {new Date(link.created_at).toLocaleDateString()}
                      </span>
                    )}
                  </span>
                  {link.status === "pending" && !expired ? (
                    <InviteLinkActions url={`${SITE_URL}/join/${link.id}`} />
                  ) : (
                    <form action={deleteIntakeLink}>
                      <input type="hidden" name="id" value={link.id} />
                      <button type="submit" className="text-sm text-red-600 hover:underline">
                        Remove
                      </button>
                    </form>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Add a tenant manually
        </h2>
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
