import Link from "next/link";
import { apiFetch, apiGetCurrentUser } from "@/lib/api/client";
import { ClaimButton } from "./claim-button";

type SharePreview = {
  status: "open" | "claimed" | "revoked";
  fullName: string;
  currentCity: string | null;
  kycStatus: string;
};

export default async function ProfileSharePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const user = await apiGetCurrentUser();

  let preview: SharePreview | null = null;
  if (user && /^[0-9a-f-]{36}$/i.test(token)) {
    preview = (await apiFetch(`/profile-shares/${token}/preview`).catch(() => null)) as SharePreview | null;
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 py-12 dark:bg-black">
      <p className="mb-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">RentVault</p>
      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950">
        {!user ? (
          <div className="flex flex-col gap-4 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              A tenant shared their renter profile with you. Sign in to your RentVault owner account
              to view it — then reopen this link.
            </p>
            <Link
              href="/login"
              className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
            >
              Sign in / create owner account
            </Link>
          </div>
        ) : !preview ? (
          <p className="text-center text-sm text-zinc-500">
            This share link doesn&apos;t exist or has been removed.
          </p>
        ) : preview.status === "revoked" ? (
          <p className="text-center text-sm text-zinc-500">
            The tenant has revoked this share link.
          </p>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <p className="text-sm text-zinc-500">Shared renter profile</p>
              <p className="mt-1 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                {preview.fullName || "Unnamed tenant"}
              </p>
              {preview.currentCity && (
                <p className="text-sm text-zinc-500">{preview.currentCity}</p>
              )}
              {preview.kycStatus === "verified" && (
                <p className="mt-1 text-sm font-medium text-emerald-600 dark:text-emerald-500">
                  Verified ✓
                </p>
              )}
            </div>
            <ClaimButton token={token} />
            <p className="text-center text-xs text-zinc-400">
              Accepting adds this tenant to your Tenants list with access to their profile and
              documents (until they revoke it).
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
