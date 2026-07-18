"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }
  return { supabase, user };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function addProperty(formData: FormData) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("properties").insert({
    owner_id: user.id,
    nickname: String(formData.get("nickname") ?? "").trim(),
    address_line1: String(formData.get("address_line1") ?? "").trim(),
    address_line2: String(formData.get("address_line2") ?? "").trim() || null,
    city: String(formData.get("city") ?? "").trim(),
    state: String(formData.get("state") ?? "").trim(),
    pincode: String(formData.get("pincode") ?? "").trim(),
    property_type: String(formData.get("property_type") ?? "apartment"),
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) {
    throw new Error(`Could not add property: ${error.message}`);
  }

  revalidatePath("/dashboard/properties");
  revalidatePath("/dashboard");
}

export async function addTenant(formData: FormData) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("tenants").insert({
    owner_id: user.id,
    full_name: String(formData.get("full_name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || null,
    kyc_status: String(formData.get("kyc_status") ?? "pending"),
    notes: String(formData.get("notes") ?? "").trim() || null,
  });

  if (error) {
    throw new Error(`Could not add tenant: ${error.message}`);
  }

  revalidatePath("/dashboard/tenants");
  revalidatePath("/dashboard");
}

export async function addLease(formData: FormData) {
  const { supabase, user } = await requireUser();

  const propertyId = String(formData.get("property_id") ?? "");
  const endDate = String(formData.get("end_date") ?? "").trim();

  const { error } = await supabase.from("leases").insert({
    owner_id: user.id,
    property_id: propertyId,
    tenant_id: String(formData.get("tenant_id") ?? ""),
    rent_amount: Number(formData.get("rent_amount") ?? 0),
    deposit_amount: formData.get("deposit_amount")
      ? Number(formData.get("deposit_amount"))
      : null,
    start_date: String(formData.get("start_date") ?? ""),
    end_date: endDate || null,
    rent_due_day: Number(formData.get("rent_due_day") ?? 1),
    status: "active",
  });

  if (error) {
    throw new Error(`Could not create lease: ${error.message}`);
  }

  revalidatePath(`/dashboard/properties/${propertyId}`);
  revalidatePath("/dashboard/rent");
  revalidatePath("/dashboard");
}

export async function endLease(formData: FormData) {
  const { supabase } = await requireUser();

  const leaseId = String(formData.get("lease_id") ?? "");
  const { error } = await supabase
    .from("leases")
    .update({ status: "ended", end_date: new Date().toISOString().slice(0, 10) })
    .eq("id", leaseId);

  if (error) {
    throw new Error(`Could not end lease: ${error.message}`);
  }

  revalidatePath("/dashboard/rent");
  revalidatePath("/dashboard");
}

export async function recordPayment(formData: FormData) {
  const { supabase, user } = await requireUser();

  const amountDue = Number(formData.get("amount_due") ?? 0);
  const amountPaid = Number(formData.get("amount_paid") ?? 0);

  const { error } = await supabase.from("rent_payments").upsert(
    {
      owner_id: user.id,
      lease_id: String(formData.get("lease_id") ?? ""),
      period_year: Number(formData.get("period_year") ?? 0),
      period_month: Number(formData.get("period_month") ?? 0),
      amount_due: amountDue,
      amount_paid: amountPaid,
      paid_on: String(formData.get("paid_on") ?? "") || new Date().toISOString().slice(0, 10),
      method: String(formData.get("method") ?? "bank_transfer"),
      status: amountPaid >= amountDue ? "paid" : "partial",
      notes: String(formData.get("notes") ?? "").trim() || null,
    },
    { onConflict: "lease_id,period_year,period_month" }
  );

  if (error) {
    throw new Error(`Could not record payment: ${error.message}`);
  }

  revalidatePath("/dashboard/rent");
  revalidatePath("/dashboard");
}

export async function saveProfile(formData: FormData) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("profiles").upsert({
    id: user.id,
    display_name: String(formData.get("display_name") ?? "").trim() || null,
    country_of_residence: String(formData.get("country_of_residence") ?? "").trim() || null,
    preferred_currency: String(formData.get("preferred_currency") ?? "USD"),
    upi_vpa: String(formData.get("upi_vpa") ?? "").trim() || null,
    upi_name: String(formData.get("upi_name") ?? "").trim() || null,
  });

  if (error) {
    throw new Error(`Could not save profile: ${error.message}`);
  }

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
  const { supabase, user } = await requireUser();

  const { leaseId, periodYear, periodMonth, amount, phone, tenantName, propertyNickname, monthLabel } =
    input;

  const { data: profile } = await supabase
    .from("profiles")
    .select("upi_vpa")
    .eq("id", user.id)
    .maybeSingle();

  // A pay link is only useful if the owner has a UPI ID for the page to show.
  let payLinkUrl: string | null = null;
  if (profile?.upi_vpa) {
    const { data: payLink, error } = await supabase
      .from("pay_links")
      .upsert(
        {
          owner_id: user.id,
          lease_id: leaseId,
          period_year: periodYear,
          period_month: periodMonth,
          amount_due: amount,
        },
        { onConflict: "lease_id,period_year,period_month" }
      )
      .select("id")
      .single();

    if (error) {
      throw new Error(`Could not create pay link: ${error.message}`);
    }

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
  const { supabase, user } = await requireUser();

  const propertyId = String(formData.get("property_id") ?? "");
  const { error } = await supabase.from("intake_links").insert({
    owner_id: user.id,
    property_id: propertyId || null,
  });

  if (error) {
    throw new Error(`Could not create invite link: ${error.message}`);
  }

  revalidatePath("/dashboard/tenants");
}

export async function deleteIntakeLink(formData: FormData) {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  const { error } = await supabase.from("intake_links").delete().eq("id", id);

  if (error) {
    throw new Error(`Could not delete invite link: ${error.message}`);
  }

  revalidatePath("/dashboard/tenants");
}

export async function deleteDocument(formData: FormData) {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "");

  const { error: storageError } = await supabase.storage.from("documents").remove([storagePath]);
  if (storageError) {
    throw new Error(`Could not delete file: ${storageError.message}`);
  }

  const { error } = await supabase.from("documents").delete().eq("id", id);
  if (error) {
    throw new Error(`Could not delete document: ${error.message}`);
  }

  revalidatePath("/dashboard/documents");
}
