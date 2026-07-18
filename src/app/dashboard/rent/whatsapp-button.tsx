"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createWhatsAppReminderUrl } from "../actions";

export function WhatsAppPayButton({
  label,
  leaseId,
  periodYear,
  periodMonth,
  amount,
  phone,
  tenantName,
  propertyNickname,
  monthLabel,
}: {
  label: string;
  leaseId: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
  phone: string;
  tenantName: string;
  propertyNickname: string;
  monthLabel: string;
}) {
  const router = useRouter();
  const [isWorking, setIsWorking] = useState(false);

  async function handleClick() {
    setIsWorking(true);
    // Open the tab synchronously inside the click gesture, then point it at
    // WhatsApp once the pay link exists — popup blockers kill window.open
    // calls that happen after an await.
    const tab = window.open("about:blank", "_blank");
    try {
      const url = await createWhatsAppReminderUrl({
        leaseId,
        periodYear,
        periodMonth,
        amount,
        phone,
        tenantName,
        propertyNickname,
        monthLabel,
      });
      if (tab) {
        tab.location.href = url;
      } else {
        window.location.href = url;
      }
      router.refresh();
    } finally {
      setIsWorking(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isWorking}
      className="rounded-full border border-emerald-600 px-5 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-500 dark:hover:bg-emerald-950"
    >
      {isWorking ? "..." : label}
    </button>
  );
}
