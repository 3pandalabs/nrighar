"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch, apiGetCurrentUser, apiLogout } from "@/lib/api/client";
import { describeApiError, type ActionResult } from "@/lib/apiErrors";
import type { AadhaarOtpStart, IdentityVerification } from "@/lib/types";

async function requireUser() {
  const user = await apiGetCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function saveTenantProfile(formData: FormData) {
  const user = await requireUser();

  await apiFetch("/tenant-profile", {
    method: "PATCH",
    body: JSON.stringify({
      fullName: String(formData.get("full_name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      email: String(formData.get("email") ?? "").trim() || user.email,
      currentCity: String(formData.get("current_city") ?? "").trim() || undefined,
      employer: String(formData.get("employer") ?? "").trim() || undefined,
    }),
  });

  redirect("/tenant?saved=1");
}

export async function createProfileShare() {
  await requireUser();

  await apiFetch("/profile-shares", { method: "POST" });

  revalidatePath("/tenant");
}

export async function revokeProfileShare(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  await apiFetch(`/profile-shares/${id}/revoke`, { method: "POST" });

  revalidatePath("/tenant");
}

export async function deleteTenantDocument(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  // NOTE: api/ROUTES.md has no storage-object-delete route yet — this removes
  // the metadata row only; the R2 object is orphaned until that route exists.
  await apiFetch(`/tenant-documents/${id}`, { method: "DELETE" });

  revalidatePath("/tenant");
}

export async function getUploadUrl(filename: string): Promise<{ key: string; url: string }> {
  const user = await requireUser();
  const key = `${user.id}/${randomUUID()}-${filename}`;
  const result = await apiFetch("/storage/presign-upload", {
    method: "POST",
    body: JSON.stringify({ key }),
  });
  return { key, url: result.url };
}

export async function recordTenantDocument(input: { docType: string; title: string; storagePath: string }) {
  await requireUser();
  await apiFetch("/tenant-documents", { method: "POST", body: JSON.stringify(input) });
}

export async function getDownloadUrl(key: string): Promise<string | null> {
  await requireUser();
  try {
    const result = await apiFetch("/storage/presign-download", {
      method: "POST",
      body: JSON.stringify({ key }),
    });
    return result.url;
  } catch {
    return null;
  }
}

export async function tenantSignOut() {
  await apiLogout();
  redirect("/");
}

export async function submitListingApplication(formData: FormData) {
  await requireUser();

  const listingId = String(formData.get("listing_id") ?? "");
  const monthlyIncome = String(formData.get("monthly_income") ?? "").trim();
  const profileHighlights = String(formData.get("profile_highlights") ?? "").trim();

  await apiFetch(`/listings/${listingId}/applications`, {
    method: "POST",
    body: JSON.stringify({
      proposedRent: Number(formData.get("proposed_rent") ?? 0),
      moveInDate: String(formData.get("move_in_date") ?? ""),
      monthlyIncome: monthlyIncome ? Number(monthlyIncome) : undefined,
      profileHighlights: profileHighlights || undefined,
    }),
  });

  revalidatePath("/tenant/listings");
}

export async function sendApplicationMessage(formData: FormData) {
  await requireUser();

  const applicationId = String(formData.get("application_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await apiFetch(`/applications/${applicationId}/messages`, { method: "POST", body: JSON.stringify({ body }) });

  revalidatePath("/tenant/listings");
}

// --- Identity verification (PAN / Aadhaar OTP) ------------------------------
//
// These return an ActionResult instead of throwing, unlike the actions above.
// The reason is the failure modes: a wrong OTP or a mistyped PAN is the user's
// to fix and needs inline copy next to the field, while an exhausted monthly
// quota is ours and must NOT invite a retry. Throwing into the error boundary
// would flatten both into one page-level "something went wrong".
//
// The raw number goes browser -> Server Action -> API over HTTPS and is never
// persisted anywhere in `web/`. The API masks it before it is stored, so
// nothing that comes back contains it.

export async function verifyOwnPan(panNumber: string): Promise<ActionResult<IdentityVerification>> {
  await requireUser();
  try {
    const result = (await apiFetch("/identity/pan", {
      method: "POST",
      body: JSON.stringify({ panNumber }),
    })) as IdentityVerification;
    revalidatePath("/tenant/verify");
    revalidatePath("/tenant");
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: describeApiError(err) };
  }
}

export async function startAadhaarVerification(
  aadhaarNumber: string
): Promise<ActionResult<AadhaarOtpStart>> {
  await requireUser();
  try {
    const result = (await apiFetch("/identity/aadhaar/otp", {
      method: "POST",
      body: JSON.stringify({ aadhaarNumber }),
    })) as AadhaarOtpStart;
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: describeApiError(err) };
  }
}

export async function submitAadhaarOtp(
  sessionId: string,
  otp: string
): Promise<ActionResult<IdentityVerification>> {
  await requireUser();
  try {
    const result = (await apiFetch("/identity/aadhaar/verify", {
      method: "POST",
      body: JSON.stringify({ sessionId, otp }),
    })) as IdentityVerification;
    revalidatePath("/tenant/verify");
    revalidatePath("/tenant");
    return { ok: true, data: result };
  } catch (err) {
    return { ok: false, error: describeApiError(err) };
  }
}
