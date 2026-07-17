// INR -> home-currency display helper. Rates come from the free frankfurter.dev
// API (ECB reference rates, no key needed), cached for an hour; the static
// fallback keeps the dashboard usable if the API is unreachable. Figures are
// labeled approximate in the UI — this is orientation, not accounting.
const FALLBACK_RATES_FROM_INR: Record<string, number> = {
  USD: 0.012,
  GBP: 0.0095,
  EUR: 0.011,
  AED: 0.044,
  SGD: 0.016,
  CAD: 0.016,
  AUD: 0.018,
};

export const SUPPORTED_CURRENCIES = Object.keys(FALLBACK_RATES_FROM_INR);

export async function getRateFromInr(currency: string): Promise<number | null> {
  if (currency === "INR") return 1;
  try {
    const res = await fetch(
      `https://api.frankfurter.dev/v1/latest?base=INR&symbols=${encodeURIComponent(currency)}`,
      { next: { revalidate: 3600 } }
    );
    if (res.ok) {
      const data = (await res.json()) as { rates?: Record<string, number> };
      const rate = data.rates?.[currency];
      if (typeof rate === "number") return rate;
    }
  } catch {
    // fall through to static fallback
  }
  return FALLBACK_RATES_FROM_INR[currency] ?? null;
}

export function formatInr(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatApprox(amount: number, currency: string, rateFromInr: number | null): string | null {
  if (rateFromInr == null || currency === "INR") return null;
  const converted = amount * rateFromInr;
  const formatted = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(converted);
  return `≈ ${formatted}`;
}
