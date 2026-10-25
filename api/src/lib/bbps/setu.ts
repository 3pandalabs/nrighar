import { providerEnv } from "../providers/env.js";
import { ProviderError, providerFetch } from "../providers/http.js";
import type { BbpsProvider, BillStatus, FetchedBill } from "./provider.js";

// Setu BBPS adapter.
//
// Same caveat as the other two adapters: shapes follow Setu's published BBPS
// bill-fetch API (`POST /bills/fetch`, `client-id` / `client-secret` /
// `x-product-instance-id` headers, `customerParams` name/value pairs), written
// without sandbox access. Verify against your contract's docs before going
// live — in particular `customerParams`, whose accepted names vary per biller
// and are the usual cause of a fetch failing for one board and working for
// another.

interface SetuBillFetchResponse {
  success?: boolean;
  data?: {
    billerBillID?: string;
    billNumber?: string;
    billDate?: string;
    dueDate?: string;
    billAmount?: number | string;
    amount?: number | string;
    billPeriod?: string;
    customerName?: string;
    billStatus?: string;
    status?: string;
    refID?: string;
  };
  error?: { code?: string; detail?: string };
}

function headers(): Record<string, string> {
  return {
    "client-id": providerEnv.setuClientId,
    "client-secret": providerEnv.setuClientSecret,
    "x-product-instance-id": providerEnv.setuProductInstanceId,
  };
}

// Amounts arrive as paise at some billers and rupees at others, and as a
// number at both — which is exactly the shape that quietly loses precision.
// Everything is normalised to a decimal string here and stays a string all the
// way into the numeric(12,2) column; no float ever touches a money value in
// this codebase.
function toAmountString(value: number | string | undefined): string {
  if (value === undefined || value === null) return "0";
  if (typeof value === "string") return value.trim() || "0";
  return value.toFixed(2);
}

function toStatus(raw: string | undefined): BillStatus {
  const value = (raw ?? "").toUpperCase();
  if (value.includes("PAID") && !value.includes("UNPAID")) return "PAID";
  if (value.includes("UNPAID") || value.includes("DUE") || value.includes("PENDING")) return "UNPAID";
  // Never guess. An unrecognised status becomes UNKNOWN, and an UNKNOWN bill
  // is never alerted on as overdue — telling a landlord their tenant hasn't
  // paid when we don't actually know is worse than saying nothing.
  return "UNKNOWN";
}

export class SetuBbpsProvider implements BbpsProvider {
  readonly name = "setu";

  async fetchBill(input: { billerId: string; consumerNumber: string; idempotencyKey: string }): Promise<FetchedBill> {
    const res = await providerFetch<SetuBillFetchResponse>({
      method: "POST",
      url: `${providerEnv.setuBaseUrl.replace(/\/$/, "")}/bills/fetch`,
      headers: headers(),
      body: {
        billerId: input.billerId,
        customerParams: [{ name: "Consumer Number", value: input.consumerNumber }],
      },
      idempotencyKey: input.idempotencyKey,
      timeoutMs: 20_000,
      // Bill fetch reaches a state electricity board's own system, which is
      // where the latency and the flakiness live. Worth two attempts; not
      // worth three, since a board that is down stays down for longer than a
      // backoff.
      maxAttempts: 2,
    });

    const data = res.data.data;
    if (res.data.success === false || !data) {
      const detail = res.data.error?.detail ?? "unknown";
      // "No bill available" is a real answer, not a failure — most boards
      // return it for the three weeks between bills.
      if (/no\s*bill|not\s*found|no\s*outstanding/i.test(detail)) {
        return {
          found: false,
          billNumber: null,
          billDate: null,
          dueDate: null,
          amountDue: "0",
          status: "UNKNOWN",
          billPeriod: null,
          customerName: null,
          providerRef: null,
          raw: { detail },
        };
      }
      throw new ProviderError("invalid_request", `setu bill fetch failed: ${detail}`, {
        httpStatus: res.httpStatus,
        detail,
      });
    }

    return {
      found: true,
      billNumber: data.billNumber ?? data.billerBillID ?? null,
      billDate: data.billDate ?? null,
      dueDate: data.dueDate ?? null,
      amountDue: toAmountString(data.billAmount ?? data.amount),
      status: toStatus(data.billStatus ?? data.status),
      billPeriod: data.billPeriod ?? null,
      customerName: data.customerName ?? null,
      providerRef: data.refID ?? data.billerBillID ?? null,
      raw: {
        billPeriod: data.billPeriod ?? null,
        billerBillID: data.billerBillID ?? null,
      },
    };
  }
}
