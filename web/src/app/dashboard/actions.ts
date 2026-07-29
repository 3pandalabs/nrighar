"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { apiFetch, apiGetCurrentUser, apiLogout } from "@/lib/api/client";

async function requireUser() {
  const user = await apiGetCurrentUser();
  if (!user) {
    redirect("/login");
  }
  return user;
}

export async function signOut() {
  await apiLogout();
  redirect("/");
}

export async function addProperty(formData: FormData) {
  await requireUser();

  await apiFetch("/properties", {
    method: "POST",
    body: JSON.stringify({
      nickname: String(formData.get("nickname") ?? "").trim(),
      addressLine1: String(formData.get("address_line1") ?? "").trim(),
      addressLine2: String(formData.get("address_line2") ?? "").trim() || undefined,
      city: String(formData.get("city") ?? "").trim(),
      state: String(formData.get("state") ?? "").trim(),
      pincode: String(formData.get("pincode") ?? "").trim(),
      propertyType: String(formData.get("property_type") ?? "apartment"),
      bedrooms: formData.get("bedrooms") ? Number(formData.get("bedrooms")) : undefined,
      notes: String(formData.get("notes") ?? "").trim() || undefined,
    }),
  });

  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard");
}

export async function addTenant(formData: FormData) {
  await requireUser();

  await apiFetch("/tenants", {
    method: "POST",
    body: JSON.stringify({
      fullName: String(formData.get("full_name") ?? "").trim(),
      phone: String(formData.get("phone") ?? "").trim() || undefined,
      email: String(formData.get("email") ?? "").trim() || undefined,
      kycStatus: String(formData.get("kyc_status") ?? "pending"),
      notes: String(formData.get("notes") ?? "").trim() || undefined,
    }),
  });

  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard");
}

export async function addLease(formData: FormData) {
  await requireUser();

  const propertyId = String(formData.get("property_id") ?? "");
  const endDate = String(formData.get("end_date") ?? "").trim();

  await apiFetch("/leases", {
    method: "POST",
    body: JSON.stringify({
      propertyId,
      tenantId: String(formData.get("tenant_id") ?? ""),
      rentAmount: Number(formData.get("rent_amount") ?? 0),
      depositAmount: formData.get("deposit_amount") ? Number(formData.get("deposit_amount")) : undefined,
      startDate: String(formData.get("start_date") ?? ""),
      endDate: endDate || undefined,
      rentDueDay: Number(formData.get("rent_due_day") ?? 1),
      status: "active",
    }),
  });

  revalidatePath(`/dashboard/properties/${propertyId}`);
  revalidatePath("/dashboard/rent");
  revalidatePath("/dashboard");
}

export async function endLease(formData: FormData) {
  await requireUser();

  const leaseId = String(formData.get("lease_id") ?? "");
  await apiFetch(`/leases/${leaseId}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "ended", endDate: new Date().toISOString().slice(0, 10) }),
  });

  revalidatePath("/dashboard/rent");
  revalidatePath("/dashboard");
}

export async function recordPayment(formData: FormData) {
  await requireUser();

  const amountDue = Number(formData.get("amount_due") ?? 0);
  const amountPaid = Number(formData.get("amount_paid") ?? 0);

  await apiFetch("/rent-payments", {
    method: "PUT",
    body: JSON.stringify({
      leaseId: String(formData.get("lease_id") ?? ""),
      periodYear: Number(formData.get("period_year") ?? 0),
      periodMonth: Number(formData.get("period_month") ?? 0),
      amountDue,
      amountPaid,
      paidOn: String(formData.get("paid_on") ?? "") || new Date().toISOString().slice(0, 10),
      method: String(formData.get("method") ?? "bank_transfer"),
      status: amountPaid >= amountDue ? "paid" : "partial",
      notes: String(formData.get("notes") ?? "").trim() || undefined,
    }),
  });

  revalidatePath("/dashboard/rent");
  revalidatePath("/dashboard");
}

export async function saveProfile(formData: FormData) {
  await requireUser();

  await apiFetch("/profile", {
    method: "PATCH",
    body: JSON.stringify({
      displayName: String(formData.get("display_name") ?? "").trim() || undefined,
      countryOfResidence: String(formData.get("country_of_residence") ?? "").trim() || undefined,
      preferredCurrency: String(formData.get("preferred_currency") ?? "USD"),
      upiVpa: String(formData.get("upi_vpa") ?? "").trim() || undefined,
      upiName: String(formData.get("upi_name") ?? "").trim() || undefined,
    }),
  });

  revalidatePath("/dashboard");
  redirect("/dashboard/settings?saved=1");
}

export async function createWhatsAppReminderUrl(input: {
  leaseId: string;
  periodYear: number;
  periodMonth: number;
  amount: number;
  phone: string;
  tenantName: string;
  propertyNickname: string;
  monthLabel: string;
}): Promise<string> {
  await requireUser();

  const { leaseId, periodYear, periodMonth, amount, phone, tenantName, propertyNickname, monthLabel } =
    input;

  const profile = await apiFetch("/profile").catch(() => null);

  // A pay link is only useful if the owner has a UPI ID for the page to show.
  let payLinkUrl: string | null = null;
  if (profile?.upiVpa) {
    const payLink = await apiFetch(`/leases/${leaseId}/pay-links`, {
      method: "POST",
      body: JSON.stringify({ periodYear, periodMonth, amountDue: amount }),
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://nrighar.3pandalabs.com";
    payLinkUrl = `${siteUrl}/pay/${payLink.id}`;
    revalidatePath("/dashboard/rent");
  }

  const rupees = new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);

  const message = payLinkUrl
    ? `Hi ${tenantName}, hope you're doing well! A gentle reminder that the rent of ${rupees} for ${propertyNickname} for ${monthLabel} is due. You can pay via UPI here: ${payLinkUrl} — it opens your UPI app with my details filled in. Thank you!`
    : `Hi ${tenantName}, hope you're doing well! A gentle reminder that the rent of ${rupees} for ${propertyNickname} for ${monthLabel} is due. Please let me know once it's transferred. Thank you!`;

  const digits = phone.replace(/\D/g, "");
  const withCountry = digits.length === 10 ? `91${digits}` : digits;

  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

export async function createIntakeLink(formData: FormData) {
  await requireUser();

  const propertyId = String(formData.get("property_id") ?? "");
  await apiFetch("/intake-links", {
    method: "POST",
    body: JSON.stringify({ propertyId: propertyId || undefined }),
  });

  revalidatePath("/dashboard/tenants");
}

export async function deleteIntakeLink(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  await apiFetch(`/intake-links/${id}`, { method: "DELETE" });

  revalidatePath("/dashboard/tenants");
}

export async function deleteDocument(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  // NOTE: api/ROUTES.md has no storage-object-delete route yet — this removes
  // the metadata row only; the R2 object is orphaned until that route exists.
  await apiFetch(`/documents/${id}`, { method: "DELETE" });

  revalidatePath("/dashboard/documents");
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

export async function recordDocument(input: {
  propertyId?: string;
  docType: string;
  title: string;
  storagePath: string;
}) {
  await requireUser();
  await apiFetch("/documents", { method: "POST", body: JSON.stringify(input) });
}

// Photos land under the same owner-prefixed key space as documents (see
// getUploadUrl), inside a per-property folder so an object's purpose is
// readable from its key alone when someone is staring at the R2 bucket.
export async function getPhotoUploadUrl(
  propertyId: string,
  filename: string,
): Promise<{ key: string; url: string }> {
  const user = await requireUser();
  const key = `${user.id}/properties/${propertyId}/${randomUUID()}-${filename}`;
  const result = await apiFetch("/storage/presign-upload", {
    method: "POST",
    body: JSON.stringify({ key }),
  });
  return { key, url: result.url };
}

export async function recordPropertyPhoto(input: {
  propertyId: string;
  storagePath: string;
  caption?: string;
}) {
  await requireUser();
  await apiFetch(`/properties/${input.propertyId}/photos`, {
    method: "POST",
    body: JSON.stringify({ storagePath: input.storagePath, caption: input.caption }),
  });
  revalidatePath(`/dashboard/properties/${input.propertyId}`);
}

export async function deletePropertyPhoto(formData: FormData) {
  await requireUser();

  const propertyId = String(formData.get("property_id") ?? "");
  const photoId = String(formData.get("photo_id") ?? "");
  await apiFetch(`/properties/${propertyId}/photos/${photoId}`, { method: "DELETE" });

  revalidatePath(`/dashboard/properties/${propertyId}`);
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

export async function openListing(formData: FormData) {
  await requireUser();

  await apiFetch("/listings", {
    method: "POST",
    body: JSON.stringify({
      propertyId: String(formData.get("property_id") ?? ""),
      baseRentAsk: Number(formData.get("base_rent_ask") ?? 0),
      minLeaseMonths: formData.get("min_lease_months") ? Number(formData.get("min_lease_months")) : undefined,
    }),
  });

  revalidatePath("/dashboard/listings");
}

export async function closeListing(formData: FormData) {
  await requireUser();

  const id = String(formData.get("id") ?? "");
  await apiFetch(`/listings/${id}`, { method: "PATCH", body: JSON.stringify({ status: "closed" }) });

  revalidatePath("/dashboard/listings");
  revalidatePath(`/dashboard/listings/${id}`);
}

export async function requestApplicationKyc(formData: FormData) {
  await requireUser();

  const applicationId = String(formData.get("application_id") ?? "");
  const listingId = String(formData.get("listing_id") ?? "");
  await apiFetch(`/applications/${applicationId}/request-kyc`, { method: "POST" });

  revalidatePath(`/dashboard/listings/${listingId}`);
}

export async function decideApplication(formData: FormData) {
  await requireUser();

  const applicationId = String(formData.get("application_id") ?? "");
  const listingId = String(formData.get("listing_id") ?? "");
  const status = String(formData.get("status") ?? "");
  await apiFetch(`/applications/${applicationId}`, { method: "PATCH", body: JSON.stringify({ status }) });

  revalidatePath(`/dashboard/listings/${listingId}`);
}

export async function sendApplicationMessage(formData: FormData) {
  await requireUser();

  const applicationId = String(formData.get("application_id") ?? "");
  const listingId = String(formData.get("listing_id") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await apiFetch(`/applications/${applicationId}/messages`, { method: "POST", body: JSON.stringify({ body }) });

  revalidatePath(`/dashboard/listings/${listingId}`);
}
