"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { fetchUtilityBillNow } from "../actions";

const OUTCOMES: Record<string, string> = {
  fetched: "Updated.",
  // Normal for most of the month — the biller simply hasn't issued one yet, and
  // saying so stops the landlord pressing the button again to "make it work".
  no_bill: "No bill outstanding right now.",
  not_configured: "Automatic bill checking isn't switched on yet.",
};

export function FetchNowButton({ accountId }: { accountId: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [isFetching, setIsFetching] = useState(false);

  async function handleClick() {
    setIsFetching(true);
    setMessage(null);
    const result = await fetchUtilityBillNow(accountId);
    setIsFetching(false);

    if (!result.ok) {
      setIsError(true);
      setMessage(result.error);
      return;
    }

    setIsError(false);
    setMessage(OUTCOMES[result.data.kind] ?? "Done.");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isFetching}
        className="whitespace-nowrap rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        {isFetching ? "Checking…" : "Check now"}
      </button>
      {message && (
        <span className={`text-xs ${isError ? "text-red-600 dark:text-red-400" : "text-zinc-500"}`}>
          {message}
        </span>
      )}
    </div>
  );
}
