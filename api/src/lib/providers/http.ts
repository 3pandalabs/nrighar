// One HTTP client for every paid provider integration, so timeout, retry and
// billability semantics are decided once instead of per adapter.
//
// The rule that shapes everything here: a call that reached the provider is
// billable whether or not we liked the answer. Retrying is therefore a
// spending decision, not just a reliability one — so only failures that
// plausibly never produced a response are retried (connection errors, request
// timeouts, 429, 5xx), and never more than RETRYABLE_ATTEMPTS times total.
// A 4xx is a permanent answer: retrying it buys the same rejection again.

export type ProviderErrorKind =
  | "timeout" // no response within the deadline — may or may not have billed
  | "network" // never reached them — safe to retry, not billable
  | "rate_limited" // 429 from the provider
  | "unauthorized" // bad/expired credentials — never retried
  | "not_found" // the record genuinely does not exist upstream
  | "invalid_request" // 4xx we caused
  | "server_error" // 5xx at the provider
  | "malformed_response"; // 2xx whose body did not match the contract

export class ProviderError extends Error {
  readonly kind: ProviderErrorKind;
  readonly httpStatus?: number;
  readonly billable: boolean;
  readonly detail?: unknown;

  constructor(kind: ProviderErrorKind, message: string, opts: { httpStatus?: number; billable?: boolean; detail?: unknown } = {}) {
    super(message);
    this.name = "ProviderError";
    this.kind = kind;
    this.httpStatus = opts.httpStatus;
    // Default to billable: assuming we were charged is the safe direction to
    // be wrong in, because the consequence is spending *less* than we could.
    this.billable = opts.billable ?? true;
    this.detail = opts.detail;
  }
}

export interface ProviderRequest {
  method: "GET" | "POST" | "PUT" | "PATCH";
  url: string;
  headers?: Record<string, string>;
  body?: unknown;
  timeoutMs?: number;
  // Sent as Idempotency-Key / X-Idempotency-Key where the provider honours it.
  // Crucially the SAME value is reused across our own retries of one logical
  // call, so a retry after a timeout re-reads the first attempt's result
  // instead of starting (and being charged for) a second one.
  idempotencyKey?: string;
  // Some providers only allow a fixed number of attempts per key; opt out
  // per-call where retrying is unsafe regardless (e.g. OTP submit).
  maxAttempts?: number;
}

export interface ProviderResponse<T> {
  data: T;
  httpStatus: number;
  durationMs: number;
  attempts: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 400;

function isRetryable(err: ProviderError): boolean {
  return err.kind === "network" || err.kind === "timeout" || err.kind === "rate_limited" || err.kind === "server_error";
}

// Full jitter. Two workers retrying the same provider after a shared outage
// must not come back in lockstep and re-trip its rate limiter — which, at a
// per-call price, would cost money as well as time.
function backoffMs(attempt: number): number {
  const ceiling = BASE_BACKOFF_MS * 2 ** (attempt - 1);
  return Math.floor(Math.random() * ceiling);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function once<T>(req: ProviderRequest): Promise<ProviderResponse<T>> {
  const timeoutMs = req.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();

  let res: Response;
  try {
    res = await fetch(req.url, {
      method: req.method,
      headers: {
        accept: "application/json",
        ...(req.body !== undefined ? { "content-type": "application/json" } : {}),
        ...(req.idempotencyKey
          ? { "idempotency-key": req.idempotencyKey, "x-idempotency-key": req.idempotencyKey }
          : {}),
        ...req.headers,
      },
      body: req.body !== undefined ? JSON.stringify(req.body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    // An abort means the deadline passed with the request already in flight:
    // the provider may well have processed and billed it. Everything else at
    // this layer (DNS, TCP, TLS) failed before they saw anything.
    const aborted = err instanceof Error && err.name === "AbortError";
    throw new ProviderError(
      aborted ? "timeout" : "network",
      aborted ? `provider request timed out after ${timeoutMs}ms` : `provider request failed: ${String(err)}`,
      { billable: aborted },
    );
  } finally {
    clearTimeout(timer);
  }

  const durationMs = Date.now() - startedAt;
  const text = await res.text().catch(() => "");

  if (!res.ok) {
    throw new ProviderError(statusToKind(res.status), `provider responded ${res.status}`, {
      httpStatus: res.status,
      // A 401/429 is refused before any lookup happens at every provider we
      // integrate with, so it does not appear on the invoice.
      billable: res.status !== 401 && res.status !== 403 && res.status !== 429,
      detail: text.slice(0, 500),
    });
  }

  let data: T;
  try {
    data = (text ? JSON.parse(text) : {}) as T;
  } catch {
    throw new ProviderError("malformed_response", "provider returned a non-JSON body", {
      httpStatus: res.status,
      detail: text.slice(0, 500),
    });
  }

  return { data, httpStatus: res.status, durationMs, attempts: 1 };
}

function statusToKind(status: number): ProviderErrorKind {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  return "invalid_request";
}

export async function providerFetch<T>(req: ProviderRequest): Promise<ProviderResponse<T>> {
  const maxAttempts = req.maxAttempts ?? DEFAULT_MAX_ATTEMPTS;
  let lastError: ProviderError | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await once<T>(req);
      return { ...res, attempts: attempt };
    } catch (err) {
      const providerErr = err instanceof ProviderError ? err : new ProviderError("network", String(err));
      lastError = providerErr;
      if (attempt === maxAttempts || !isRetryable(providerErr)) break;
      await sleep(backoffMs(attempt));
    }
  }

  throw lastError ?? new ProviderError("network", "provider request failed with no recorded error");
}
