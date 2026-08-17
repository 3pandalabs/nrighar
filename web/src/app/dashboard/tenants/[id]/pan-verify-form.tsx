"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidPan, normalizeDocumentNumber } from "@/lib/identity";
import { verifyTenantPan } from "../../actions";
import type { IdentityVerification } from "@/lib/types";

export function PanVerifyForm({
  tenantId,
  tenantName,
}: {
  tenantId: string;
  tenantName: string;
}) {
  const router = useRouter();
  const [pan, setPan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IdentityVerification | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalized = normalizeDocumentNumber(pan);
  const looksValid = isValidPan(normalized);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!looksValid || isSubmitting) return;

    setError(null);
    setResult(null);
    setIsSubmitting(true);
    const response = await verifyTenantPan(tenantId, normalized);
    setIsSubmitting(false);

    if (!response.ok) {
      setError(response.error);
      return;
    }

    setResult(response.data);
    setPan("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <p className="text-sm text-zinc-500">
        Enter the PAN from your tenant&apos;s ID and we&apos;ll check it against the income-tax
        record, then compare the registered name with{" "}
        <strong className="text-zinc-900 dark:text-zinc-50">{tenantName}</strong> — the name on your
        record for them.
      </p>

      <div className="flex flex-wrap items-start gap-3">
        <input
          value={pan}
          onChange={(e) => setPan(e.target.value.toUpperCase())}
          placeholder="ABCPE1234F"
          maxLength={12}
          autoComplete="off"
          spellCheck={false}
          className="w-44 rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm tracking-wider uppercase dark:border-zinc-700 dark:bg-zinc-900"
        />
        <button
          type="submit"
          disabled={!looksValid || isSubmitting}
          className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {isSubmitting ? "Checking…" : "Verify PAN"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      {result && <Outcome result={result} tenantName={tenantName} />}
    </form>
  );
}

function Outcome({ result, tenantName }: { result: IdentityVerification; tenantName: string }) {
  if (result.status === "verified") {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
        Verified — this PAN is registered to {result.verifiedName ?? tenantName}.
      </p>
    );
  }

  // The wording here is doing real work. A mismatch is most often a spelling or
  // a missing middle name, and a landlord who reads it as "this tenant is
  // lying" makes a bad decision on thin evidence. Say what we actually know.
  if (result.status === "name_mismatch") {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-400">
        This PAN exists and is registered to{" "}
        <strong>{result.verifiedName ?? "a different name"}</strong>, which doesn&apos;t match your
        record ({tenantName}). That&apos;s often a spelling difference or a middle name you
        don&apos;t have on file — check the spelling on your record before treating it as a problem.
      </p>
    );
  }

  if (result.status === "not_found") {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
        No PAN record matched that number. Re-check the number on their ID.
      </p>
    );
  }

  return (
    <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      We couldn&apos;t complete this check right now — this is on our side, not a problem with the
      tenant&apos;s ID.
    </p>
  );
}
