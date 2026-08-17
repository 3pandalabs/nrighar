"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isValidPan, normalizeDocumentNumber } from "@/lib/identity";
import { verifyOwnPan } from "../actions";
import type { IdentityVerification } from "@/lib/types";

export function PanForm() {
  const router = useRouter();
  const [pan, setPan] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<IdentityVerification | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalized = normalizeDocumentNumber(pan);
  // Checked as they type so the button is dead until the format is right. Every
  // press that never leaves the browser is a lookup we don't pay for — and the
  // server checks this again anyway, since the client can always be bypassed.
  const looksValid = isValidPan(normalized);
  const showFormatHint = normalized.length >= 10 && !looksValid;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!looksValid || isSubmitting) return;

    setError(null);
    setResult(null);
    setIsSubmitting(true);

    const response = await verifyOwnPan(normalized);
    setIsSubmitting(false);

    if (!response.ok) {
      setError(response.error);
      return;
    }

    setResult(response.data);
    // Clear the field on any definitive answer — there is no reason for a PAN
    // to sit in a text input after we're done with it.
    setPan("");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        PAN number
        <input
          value={pan}
          onChange={(e) => setPan(e.target.value.toUpperCase())}
          placeholder="ABCPE1234F"
          maxLength={12}
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="rounded-lg border border-zinc-300 px-3 py-2 font-mono text-sm font-normal tracking-wider uppercase dark:border-zinc-700 dark:bg-zinc-900"
        />
        {showFormatHint && (
          <span className="text-xs text-amber-700 dark:text-amber-500">
            That doesn&apos;t look like a valid PAN — 5 letters, 4 digits, then a letter.
          </span>
        )}
      </label>

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
          {error}
        </p>
      )}

      {result && <PanResult result={result} />}

      <div>
        <button
          type="submit"
          disabled={!looksValid || isSubmitting}
          className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {isSubmitting ? "Checking…" : "Verify PAN"}
        </button>
      </div>
    </form>
  );
}

function PanResult({ result }: { result: IdentityVerification }) {
  if (result.status === "verified") {
    return (
      <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:bg-emerald-950 dark:text-emerald-400">
        Verified{result.verifiedName ? ` as ${result.verifiedName}` : ""}.
        {/* Says why it was instant, so "that was suspiciously fast" doesn't
            read as "it didn't really check". */}
        {result.cached && " We'd already verified this PAN recently, so nothing was re-checked."}
      </p>
    );
  }

  if (result.status === "name_mismatch") {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-400">
        This PAN is real, but it&apos;s registered to{" "}
        {result.verifiedName ? <strong>{result.verifiedName}</strong> : "a different name"}, which
        doesn&apos;t match the name on your profile. If your profile name is spelled differently or
        missing a middle name, correct it and try again — otherwise your landlord will review this
        by hand.
      </p>
    );
  }

  if (result.status === "not_found") {
    return (
      <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-400">
        No PAN record matched that number. Check the card and try again.
      </p>
    );
  }

  return (
    <p className="rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      We couldn&apos;t complete this check right now. Nothing is wrong with what you entered — your
      landlord can verify it manually.
    </p>
  );
}
