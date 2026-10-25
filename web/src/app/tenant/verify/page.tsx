import { apiFetch } from "@/lib/api/client";
import type { IdentityVerification, TenantProfile } from "@/lib/types";
import { VerificationRow } from "@/components/VerificationStatus";
import { PanForm } from "./pan-form";
import { AadhaarForm } from "./aadhaar-form";

export default async function VerifyIdentityPage() {
  const [profile, verifications] = await Promise.all([
    apiFetch("/tenant-profile").catch(() => null) as Promise<TenantProfile | null>,
    apiFetch("/identity/verifications").catch(() => []) as Promise<IdentityVerification[]>,
  ]);

  const hasVerified = verifications.some((v) => v.status === "verified");

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Verify your ID</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Landlords are far more likely to accept an application from a verified renter. This takes
          a minute and you only need to do it once.
        </p>
      </div>

      {/* The name match is the entire mechanism, and a tenant who doesn't know
          that will "fix" a mismatch by re-entering the same PAN. Say it once,
          up front, next to the name it will be compared against. */}
      {profile && (
        <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400">
          We&apos;ll check the name on your ID against{" "}
          <strong className="text-zinc-900 dark:text-zinc-50">{profile.fullName}</strong>, the name
          on your profile. If your ID shows a different spelling or a middle name, update your
          profile first so the two match.
        </p>
      )}

      {hasVerified && (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-400">
          Your identity is verified. Landlords you share your profile with can see this.
        </p>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">PAN</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-500">
          Instant. We check the number against the income-tax record and compare the registered
          name with yours.
        </p>
        <PanForm />
      </section>

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Aadhaar</h2>
        <p className="mb-4 mt-1 text-sm text-zinc-500">
          Needs an OTP sent to the mobile number registered with your Aadhaar.
        </p>
        <AadhaarForm />
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Your verification history
        </h2>
        {verifications.length > 0 ? (
          <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
            {verifications.map((verification) => (
              <VerificationRow key={verification.id} verification={verification} />
            ))}
          </ul>
        ) : (
          <p className="text-sm text-zinc-500">You haven&apos;t verified an ID yet.</p>
        )}
      </section>
    </div>
  );
}
