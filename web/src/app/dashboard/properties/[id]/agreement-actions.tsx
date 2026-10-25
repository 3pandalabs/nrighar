"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSigningUrl, sendLeaseAgreement } from "../../actions";

// "Send for signature" is the one button on this page that spends money, so it
// asks first. Not a modal — an inline two-step, because a confirm() dialog in a
// Server Component tree is more machinery than one boolean deserves.
export function SendForSignatureButton({
  agreementId,
  propertyId,
}: {
  agreementId: string;
  propertyId: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  async function handleSend() {
    setIsSending(true);
    setError(null);
    const result = await sendLeaseAgreement(agreementId, propertyId);
    setIsSending(false);

    if (!result.ok) {
      setError(result.error);
      setConfirming(false);
      return;
    }

    setConfirming(false);
    router.refresh();
  }

  if (!confirming) {
    return (
      <div className="flex flex-col gap-2">
        <div>
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
          >
            Send for signature
          </button>
        </div>
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-sm text-zinc-700 dark:text-zinc-300">
        This sends the agreement for Aadhaar e-Signature. You sign first, then your tenant is
        invited. Read the draft before sending — once it&apos;s out, changing it means starting a
        new agreement.
      </p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSend}
          disabled={isSending}
          className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {isSending ? "Sending…" : "Yes, send it"}
        </button>
        <button
          type="button"
          onClick={() => setConfirming(false)}
          className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// Provider signing links are short-lived, so this fetches a fresh one on click
// rather than rendering a stored link that may already be dead.
export function SignNowButton({
  agreementId,
  role,
}: {
  agreementId: string;
  role: "landlord" | "tenant";
}) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleClick() {
    setIsLoading(true);
    setError(null);
    const result = await getSigningUrl(agreementId, role);
    setIsLoading(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (!result.data.signUrl) {
      setError("No signing link is available yet.");
      return;
    }
    window.open(result.data.signUrl, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {isLoading ? "Opening…" : "Sign now"}
      </button>
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}
