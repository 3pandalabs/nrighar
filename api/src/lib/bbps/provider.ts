// Contract every BBPS bill-fetch vendor is adapted to.
//
// Read-only by design. This feature tracks bills; it does not pay them.
// Payment through BBPS means holding a settlement account, PCI-adjacent
// obligations and a refund story — a materially bigger commitment than
// "tell the landlord the electricity bill is overdue", which is the actual
// problem an NRI landlord has. The seam is here if that changes.

export type BillStatus = "PAID" | "UNPAID" | "UNKNOWN";

export interface FetchedBill {
  // false = the biller has no bill outstanding for this consumer right now.
  // A perfectly normal answer, and one worth caching so we don't re-ask.
  found: boolean;
  billNumber: string | null;
  billDate: string | null; // YYYY-MM-DD
  dueDate: string | null; // YYYY-MM-DD
  amountDue: string; // decimal string — never a float, this is money
  status: BillStatus;
  billPeriod: string | null;
  customerName: string | null;
  providerRef: string | null;
  raw: Record<string, unknown> | null;
}

export interface BbpsProvider {
  readonly name: string;

  fetchBill(input: {
    billerId: string;
    consumerNumber: string;
    idempotencyKey: string;
  }): Promise<FetchedBill>;
}
