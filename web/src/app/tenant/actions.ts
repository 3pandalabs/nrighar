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

export async function saveTenantProfile(formData: FormData) {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("tenant_profiles").upsert({
    user_id: user.id,
    full_name: String(formData.get("full_name") ?? "").trim(),
    phone: String(formData.get("phone") ?? "").trim() || null,
    email: String(formData.get("email") ?? "").trim() || user.email,
    current_city: String(formData.get("current_city") ?? "").trim() || null,
    employer: String(formData.get("employer") ?? "").trim() || null,
  });

  if (error) {
    throw new Error(`Could not save profile: ${error.message}`);
  }

  redirect("/tenant?saved=1");
}

export async function createProfileShare() {
  const { supabase, user } = await requireUser();

  const { error } = await supabase.from("profile_shares").insert({ tenant_user_id: user.id });
  if (error) {
    throw new Error(`Could not create share link: ${error.message}`);
  }

  revalidatePath("/tenant");
}

export async function revokeProfileShare(formData: FormData) {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  const { error } = await supabase
    .from("profile_shares")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    throw new Error(`Could not revoke: ${error.message}`);
  }

  revalidatePath("/tenant");
}

export async function deleteTenantDocument(formData: FormData) {
  const { supabase } = await requireUser();

  const id = String(formData.get("id") ?? "");
  const storagePath = String(formData.get("storage_path") ?? "");

  const { error: storageError } = await supabase.storage.from("documents").remove([storagePath]);
  if (storageError) {
    throw new Error(`Could not delete file: ${storageError.message}`);
  }

  const { error } = await supabase.from("tenant_documents").delete().eq("id", id);
  if (error) {
    throw new Error(`Could not delete document: ${error.message}`);
  }

  revalidatePath("/tenant");
}

export async function tenantSignOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
