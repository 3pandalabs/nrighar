"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { createClient } from "@/lib/supabase/client";
import { buildUpiUri } from "@/lib/upi";

export function PayActions({
  token,
  vpa,
  payeeName,
  amount,
  note,
  alreadyClaimed,
}: {
  token: string;
  vpa: string;
  payeeName: string;
  amount: number;
  note: string;
  alreadyClaimed: boolean;
}) {
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [claimed, setClaimed] = useState(alreadyClaimed);
  const [isClaiming, setIsClaiming] = useState(false);
  const trackedRef = useRef(false);

  const upiUri = buildUpiUri({ vpa, payeeName, amount, note });

  // Mark the link opened from the client, not during server render — chat apps
  // (WhatsApp included) fetch the URL server-side to build link previews, which
  // would otherwise stamp opened_at before the tenant ever tapped it.
  useEffect(() => {
    if (trackedRef.current) return;
    trackedRef.current = true;
    const supabase = createClient();
    supabase.rpc("mark_pay_link_opened", { p_token: token }).then(() => {});
  }, [token]);

  useEffect(() => {
    QRCode.toDataURL(upiUri, { width: 240, margin: 1 }).then(setQrDataUrl);
  }, [upiUri]);

  async function handleCopy() {
    await navigator.clipboard.writeText(vpa);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleClaim() {
    setIsClaiming(true);
    const supabase = createClient();
    await supabase.rpc("claim_pay_link_paid", { p_token: token });
    setIsClaiming(false);
    setClaimed(true);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <a
        href={upiUri}
        className="w-full rounded-full bg-zinc-900 px-6 py-3 text-center text-base font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
      >
        Open UPI app to pay
      </a>

      {qrDataUrl && (
        <div className="flex flex-col items-center gap-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrDataUrl} alt="UPI payment QR code" className="rounded-lg" />
          <p className="text-xs text-zinc-500">Or scan with any UPI app</p>
        </div>
      )}

      <button
        type="button"
        onClick={handleCopy}
        className="text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        {copied ? "Copied!" : `Copy UPI ID: ${vpa}`}
      </button>

      <div className="mt-2 w-full border-t border-zinc-200 pt-4 dark:border-zinc-800">
        {claimed ? (
          <p className="text-center text-sm font-medium text-emerald-600 dark:text-emerald-500">
            ✓ Thanks — your landlord has been notified that you&apos;ve paid.
          </p>
        ) : (
          <button
            type="button"
            onClick={handleClaim}
            disabled={isClaiming}
            className="w-full rounded-full border border-emerald-600 px-6 py-2.5 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-500 dark:hover:bg-emerald-950"
          >
            {isClaiming ? "..." : "I've paid ✓"}
          </button>
        )}
      </div>
    </div>
  );
}
