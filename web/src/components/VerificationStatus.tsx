import type { IdentityVerification } from "@/lib/types";

// Shared between the tenant's own verification page and the owner's tenant
// detail page, so both sides read the same words for the same status. A
// landlord and a tenant looking at one verification and describing it
// differently to each other is a support ticket.

const STYLES: Record<IdentityVerification["status"], { label: string; className: string }> = {
  verified: {
    label: "Verified",
    className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400",
  },
  // Amber, not red. The number checked out against the government record — only
  // the name didn't line up, which is usually a spelling or a middle name, not
  // fraud. Colouring it as a failure invites a landlord to reject a real tenant.
  name_mismatch: {
    label: "Name doesn't match",
    className: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  },
  not_found: {
    label: "No record found",
    className: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400",
  },
  failed: {
    label: "Check failed",
    className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  // Nothing was wrong with what the user typed, so this must not look like
  // their problem.
  not_configured: {
    label: "Not available yet",
    className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  pending: {
    label: "In progress",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-400",
  },
};

export function VerificationBadge({ status }: { status: IdentityVerification["status"] }) {
  const style = STYLES[status] ?? STYLES.failed;
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-medium ${style.className}`}>
      {style.label}
    </span>
  );
}

export function VerificationRow({ verification }: { verification: IdentityVerification }) {
  const kindLabel = verification.kind === "pan" ? "PAN" : "Aadhaar";

  return (
    <li className="flex flex-col gap-2 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span className="min-w-0">
        <span className="block font-medium text-zinc-900 dark:text-zinc-50">
          {kindLabel} · <span className="font-mono text-xs">{verification.numberMasked}</span>
        </span>
        {verification.verifiedName && (
          <span className="block text-xs text-zinc-500">
            Registered as {verification.verifiedName}
          </span>
        )}
        {verification.errorMessage && verification.status !== "verified" && (
          <span className="block text-xs text-zinc-500">{verification.errorMessage}</span>
        )}
        <span className="block text-xs text-zinc-400">
          {new Date(verification.createdAt).toLocaleDateString("en-IN", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      </span>
      <VerificationBadge status={verification.status} />
    </li>
  );
}
