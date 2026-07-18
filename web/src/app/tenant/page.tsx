import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProfileShare, TenantDocument, TenantProfile } from "@/lib/types";
import { SITE_URL } from "@/lib/upi";
import { createProfileShare, revokeProfileShare, saveTenantProfile, deleteTenantDocument } from "./actions";
import { ShareLinkActions } from "./share-link";
import { TenantDocUpload } from "./doc-upload";

const DOC_TYPE_LABELS: Record<TenantDocument["doc_type"], string> = {
  agreement: "Rent agreement",
  kyc: "ID / KYC",
  property_paper: "Property papers",
  tax: "Tax",
  other: "Other",
};

export default async function TenantHome({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const { saved } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: profile }, { data: documents }, { data: shares }] = await Promise.all([
    supabase.from("tenant_profiles").select("*").eq("user_id", user.id).maybeSingle<TenantProfile>(),
    supabase
      .from("tenant_documents")
      .select("*")
      .eq("tenant_user_id", user.id)
      .order("created_at", { ascending: false })
      .returns<TenantDocument[]>(),
    supabase
      .from("profile_shares")
      .select("*")
      .eq("tenant_user_id", user.id)
      .order("created_at", { ascending: false })
      .returns<ProfileShare[]>(),
  ]);

  const docsWithUrls = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.storage_path, 60 * 10);
      return { doc, signedUrl: data?.signedUrl ?? null };
    })
  );

  const activeShares = (shares ?? []).filter((s) => s.status !== "revoked");

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">My renter profile</h1>
        {saved === "1" && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Saved ✓
          </span>
        )}
        {profile?.kyc_status === "verified" && (
          <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
            Verified ✓
          </span>
        )}
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Details</h2>
        <form action={saveTenantProfile} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field name="full_name" label="Full name (as on your ID)" defaultValue={profile?.full_name ?? ""} required />
          <Field name="phone" label="Phone (WhatsApp)" defaultValue={profile?.phone ?? ""} />
          <Field name="email" label="Email" defaultValue={profile?.email ?? user.email ?? ""} />
          <Field name="current_city" label="Current city" defaultValue={profile?.current_city ?? ""} />
          <Field name="employer" label="Employer (optional)" defaultValue={profile?.employer ?? ""} />
          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
            >
              Save
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">My documents</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Upload once, share with any landlord. Aadhaar offline eKYC zip (from
          myaadhaar.uidai.gov.in) is the best ID document — it can be verified without revealing
          your full Aadhaar number.
        </p>
        {docsWithUrls.length > 0 && (
          <ul className="mb-4 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {docsWithUrls.map(({ doc, signedUrl }) => (
              <li key={doc.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <span className="min-w-0">
                  <span className="block truncate font-medium text-zinc-900 dark:text-zinc-50">
                    {doc.title}
                  </span>
                  <span className="text-xs text-zinc-500">{DOC_TYPE_LABELS[doc.doc_type]}</span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  {signedUrl && (
                    <a
                      href={signedUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                    >
                      Open
                    </a>
                  )}
                  <form action={deleteTenantDocument}>
                    <input type="hidden" name="id" value={doc.id} />
                    <input type="hidden" name="storage_path" value={doc.storage_path} />
                    <button type="submit" className="text-red-600 hover:underline">
                      Delete
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
        <TenantDocUpload />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Sharing</h2>
        <p className="mb-4 text-sm text-zinc-500">
          Create a link and send it to a landlord — they&apos;ll see your profile and documents.
          You can revoke access anytime.
        </p>
        <form action={createProfileShare}>
          <button
            type="submit"
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
          >
            Create share link
          </button>
        </form>
        {activeShares.length > 0 && (
          <ul className="mt-4 divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {activeShares.map((share) => (
              <li key={share.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
                <span className={share.status === "claimed" ? "text-emerald-600 dark:text-emerald-500" : "text-zinc-600 dark:text-zinc-400"}>
                  {share.status === "claimed"
                    ? `Shared with a landlord since ${new Date(share.claimed_at ?? share.created_at).toLocaleDateString()}`
                    : `Open link · created ${new Date(share.created_at).toLocaleDateString()}`}
                </span>
                <span className="flex items-center gap-3">
                  {share.status === "open" && (
                    <ShareLinkActions url={`${SITE_URL}/profile-share/${share.id}`} />
                  )}
                  <form action={revokeProfileShare}>
                    <input type="hidden" name="id" value={share.id} />
                    <button type="submit" className="text-red-600 hover:underline">
                      Revoke
                    </button>
                  </form>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Field({
  name,
  label,
  defaultValue,
  required,
}: {
  name: string;
  label: string;
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {label}
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}
