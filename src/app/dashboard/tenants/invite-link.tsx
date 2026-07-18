"use client";

import { useState } from "react";

export function InviteLinkActions({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  const message = `Hi! Please fill in your tenant details and upload your documents (ID proof, and ideally your Aadhaar offline eKYC from myaadhaar.uidai.gov.in) here: ${url}`;

  async function handleCopy() {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <span className="flex shrink-0 items-center gap-3 text-sm">
      <button
        type="button"
        onClick={handleCopy}
        className="text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
      <a
        href={`https://wa.me/?text=${encodeURIComponent(message)}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-emerald-700 underline hover:text-emerald-900 dark:text-emerald-500"
      >
        Share on WhatsApp
      </a>
    </span>
  );
}
