"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const ERRORS: Record<string, string> = {
  not_found: "This share link doesn't exist anymore.",
  revoked: "The tenant has revoked this share.",
  already_claimed: "This link was already used by another owner — ask the tenant for a fresh one.",
  own_profile: "This is your own profile link.",
  not_signed_in: "Please sign in first.",
};

export function ClaimButton({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isWorking, setIsWorking] = useState(false);

  async function handleClaim() {
    setError(null);
    setIsWorking(true);
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("claim_profile_share", {
      p_token: token,
    });
    const result = data as { ok?: boolean; tenant_id?: string; error?: string } | null;
    if (rpcError || !result?.ok) {
      setError(ERRORS[result?.error ?? ""] ?? rpcError?.message ?? "Something went wrong.");
      setIsWorking(false);
      return;
    }
    router.push(`/dashboard/tenants/${result.tenant_id}`);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleClaim}
        disabled={isWorking}
        className="w-full rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {isWorking ? "..." : "Accept & view profile"}
      </button>
      {error && <p className="text-center text-sm text-red-600">{error}</p>}
    </div>
  );
}
