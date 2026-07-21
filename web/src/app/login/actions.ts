"use server";

import { apiFetch, apiLogin, apiSignup, ApiError } from "@/lib/api/client";

type Result = { ok: true; role: "owner" | "tenant" } | { ok: false; error: string };

export async function signUp(email: string, password: string, role: "owner" | "tenant"): Promise<Result> {
  try {
    const user = await apiSignup(email, password, role);
    if (role === "tenant") {
      // Backfill the email onto tenant_profile immediately, matching the old
      // app's post-signup upsert — full profile completion happens on /tenant.
      await apiFetch("/tenant-profile", { method: "PATCH", body: JSON.stringify({ email }) });
    }
    return { ok: true, role: user.role };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.code : "unknown_error" };
  }
}

export async function signIn(email: string, password: string): Promise<Result> {
  try {
    const user = await apiLogin(email, password);
    return { ok: true, role: user.role };
  } catch (e) {
    return { ok: false, error: e instanceof ApiError ? e.code : "unknown_error" };
  }
}
