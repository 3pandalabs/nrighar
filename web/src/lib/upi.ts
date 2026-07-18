// UPI intent-link helpers. Caveat by design: NPCI anti-fraud rules mean UPI
// apps may ignore or cap the prefilled amount for payments to personal
// (non-merchant) VPAs — the pay page always shows the amount prominently so
// the tenant can type it if their app drops it.

export function buildUpiUri({
  vpa,
  payeeName,
  amount,
  note,
}: {
  vpa: string;
  payeeName: string;
  amount: number;
  note: string;
}): string {
  const params = new URLSearchParams({
    pa: vpa,
    pn: payeeName,
    am: String(amount),
    cu: "INR",
    tn: note.slice(0, 60),
  });
  return `upi://pay?${params.toString()}`;
}

export function monthLabel(year: number, month: number): string {
  return new Date(year, month - 1).toLocaleString("en-US", { month: "long", year: "numeric" });
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nrighar.3pandalabs.com";
