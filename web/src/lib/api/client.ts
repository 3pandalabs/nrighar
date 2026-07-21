import { cookies } from "next/headers";

// INTERNAL_API_URL (server-only, not NEXT_PUBLIC_-prefixed so it's never
// inlined into client bundles) points at a DNS-only hostname for this same
// origin. Same-account Cloudflare Worker subrequests to a Cloudflare-proxied
// hostname get 403'd by Cloudflare's "orange-to-orange" restriction, which
// sits ahead of WAF evaluation and can't be bypassed by a WAF skip rule
// (confirmed 2026-07-21: a WAF rule matching cf.worker.upstream_zone saw
// zero events on a failing request). Routing through the unproxied hostname
// avoids the same-zone proxy path entirely.
const API_URL = process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080";

const ACCESS_COOKIE = "nrighar_access";
const REFRESH_COOKIE = "nrighar_refresh";

export type ApiUser = { id: string; email: string; role: "owner" | "tenant" };

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string) {
    super(code);
    this.status = status;
    this.code = code;
  }
}

async function rawFetch(path: string, init: RequestInit & { token?: string } = {}) {
  const { token, headers, body, ...rest } = init;
  return fetch(`${API_URL}${path}`, {
    ...rest,
    body,
    headers: {
      ...(body && typeof body === "string" ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    cache: "no-store",
  });
}

async function parseOrThrow(res: Response) {
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(res.status, body?.error ?? "unknown_error");
  }
  return body;
}

// ---- Cookie-backed token storage (server-only: Server Components / Actions) ----
// Tokens never reach the browser as JS-readable values — httpOnly cookies only.
// This app handles Aadhaar KYC documents; an XSS-exposed token is a real risk.

async function getTokens() {
  const store = await cookies();
  return {
    accessToken: store.get(ACCESS_COOKIE)?.value ?? null,
    refreshToken: store.get(REFRESH_COOKIE)?.value ?? null,
  };
}

async function setTokens(accessToken: string, refreshToken: string) {
  const store = await cookies();
  const common = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };
  store.set(ACCESS_COOKIE, accessToken, { ...common, maxAge: 60 * 15 });
  store.set(REFRESH_COOKIE, refreshToken, { ...common, maxAge: 60 * 60 * 24 * 30 });
}

export async function clearTokens() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
}

/**
 * Authenticated fetch for Server Components / Server Actions. Handles the
 * 401 -> refresh -> retry-once flow from api/ROUTES.md automatically.
 */
export async function apiFetch(path: string, init: RequestInit = {}) {
  const { accessToken, refreshToken } = await getTokens();
  if (!accessToken) throw new ApiError(401, "not_signed_in");

  let res = await rawFetch(path, { ...init, token: accessToken });

  if (res.status === 401 && refreshToken) {
    const refreshRes = await rawFetch("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    if (refreshRes.ok) {
      const pair = (await refreshRes.json()) as { accessToken: string; refreshToken: string };
      await setTokens(pair.accessToken, pair.refreshToken);
      res = await rawFetch(path, { ...init, token: pair.accessToken });
    }
  }

  return parseOrThrow(res);
}

export async function apiGetCurrentUser(): Promise<ApiUser | null> {
  try {
    return (await apiFetch("/auth/me")) as ApiUser;
  } catch {
    return null;
  }
}

// ---- Auth entry points — call from Server Actions only, they set cookies ----

export async function apiSignup(
  email: string,
  password: string,
  role: "owner" | "tenant"
): Promise<ApiUser> {
  const res = await rawFetch("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password, role }),
  });
  const data = (await parseOrThrow(res)) as { accessToken: string; refreshToken: string; user: ApiUser };
  await setTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function apiLogin(email: string, password: string): Promise<ApiUser> {
  const res = await rawFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  const data = (await parseOrThrow(res)) as { accessToken: string; refreshToken: string; user: ApiUser };
  await setTokens(data.accessToken, data.refreshToken);
  return data.user;
}

export async function apiLogout(): Promise<void> {
  const { refreshToken } = await getTokens();
  if (refreshToken) {
    await rawFetch("/auth/logout", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    }).catch(() => {});
  }
  await clearTokens();
}
