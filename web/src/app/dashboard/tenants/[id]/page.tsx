import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { IdentityVerification, Tenant, TenantDocument, TenantProfile } from "@/lib/types";
import { VerificationRow } from "@/components/VerificationStatus";
import { getDownloadUrl } from "../../actions";
import { PanVerifyForm } from "./pan-verify-form";

const DOC_TYPE_LABELS: Record<TenantDocument["docType"], string> = {
  agreement: "Rent agreement",
  kyc: "ID / KYC",
  property_paper: "Property papers",
  tax: "Tax",
  other: "Other",
};

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let tenant: Tenant;
  try {
    tenant = await apiFetch(`/tenants/${id}`);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  // Shared profile data is only readable while the tenant's share is active —
  // if they revoke, these calls 404 (see api/ROUTES.md's share-conditional
  // reads), same "silently returns nothing" behavior as the old RLS policy.
  let sharedProfile: TenantProfile | null = null;
  let sharedDocs: TenantDocument[] = [];
  if (tenant.tenantUserId) {
    [sharedProfile, sharedDocs] = await Promise.all([
      apiFetch(`/tenant-profiles/by-owner/${tenant.tenantUserId}`).catch(() => null),
      apiFetch(`/tenant-documents/by-owner/${tenant.tenantUserId}`).catch(() => []),
    ]);
  }

  const docsWithUrls = await Promise.all(
    (sharedDocs ?? []).map(async (doc) => ({ doc, signedUrl: await getDownloadUrl(doc.storagePath) }))
  );

  // Government-source ID checks on this tenant record. Separate from the
  // kycStatus flag above, which is the coarse summary — this is the evidence
  // behind it.
  const verifications = (await apiFetch(`/tenants/${id}/identity-verifications`).catch(
    () => []
  )) as IdentityVerification[];

  return (
    <div className="flex max-w-2xl flex-col gap-8">
      <div>
        <Link
          href="/dashboard/tenants"
          className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          &larr; All tenants
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">
            {tenant.fullName}
          </h1>
          {(sharedProfile?.kycStatus ?? tenant.kycStatus) === "verified" && (
            <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400">
              Verified ✓
            </span>
          )}
        </div>
        <p className="text-sm text-zinc-500">
          {[tenant.phone, tenant.email].filter(Boolean).join(" · ")}
        </p>
      </div>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Identity verification
        </h2>

        {verifications.length > 0 && (
          <ul className="mb-6 divide-y divide-zinc-200 rounded-xl border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {verifications.map((verification) => (
              <VerificationRow key={verification.id} verification={verification} />
            ))}
          </ul>
        )}

        <PanVerifyForm tenantId={tenant.id} tenantName={tenant.fullName} />

        {/* An Aadhaar OTP goes to the tenant's own phone, so there is no
            landlord-driven version of it — saying so here stops the obvious
            "where's the Aadhaar button?" question. */}
        <p className="mt-4 border-t border-zinc-200 pt-4 text-xs text-zinc-500 dark:border-zinc-800">
          Aadhaar verification needs an OTP sent to your tenant&apos;s own mobile, so they run it
          themselves from their renter profile. Once they do, the result appears here.
        </p>
      </section>

      {tenant.tenantUserId ? (
        sharedProfile ? (
          <>
            <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
              <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Shared renter profile
              </h2>
              <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <ProfileField label="Full name" value={sharedProfile.fullName} />
                <ProfileField label="Phone" value={sharedProfile.phone} />
                <ProfileField label="Email" value={sharedProfile.email} />
                <ProfileField label="Current city" value={sharedProfile.currentCity} />
                <ProfileField label="Employer" value={sharedProfile.employer} />
                <ProfileField label="KYC status" value={sharedProfile.kycStatus} />
              </dl>
            </section>

            <section>
              <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
                Shared documents
              </h2>
              {docsWithUrls.length > 0 ? (
                <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
                  {docsWithUrls.map(({ doc, signedUrl }) => (
                    <li
                      key={doc.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium text-zinc-900 dark:text-zinc-50">
                          {doc.title}
                        </span>
                        <span className="text-xs text-zinc-500">
                          {DOC_TYPE_LABELS[doc.docType]}
                        </span>
                      </span>
                      {signedUrl && (
                        <a
                          href={signedUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                        >
                          Open
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-zinc-500">No documents in the shared profile yet.</p>
              )}
            </section>
          </>
        ) : (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
            This tenant has revoked access to their shared profile. Their basic contact details
            above remain from your own records.
          </p>
        )
      ) : (
        <p className="text-sm text-zinc-500">
          This tenant was added manually and has no linked renter profile. Documents they
          submitted via an invite link are in your{" "}
          <Link href="/dashboard/documents" className="underline">
            document vault
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function ProfileField({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className="capitalize-none font-medium text-zinc-900 dark:text-zinc-50">
        {value || "—"}
      </dd>
    </div>
  );
}
