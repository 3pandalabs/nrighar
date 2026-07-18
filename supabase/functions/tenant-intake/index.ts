// Tenant intake submission. Anonymous but token-gated: the caller must present
// a pending, unexpired intake_links uuid. Files are stored in the OWNER's
// storage folder (documents/<owner_id>/intake/<token>/...) so the owner's
// existing storage RLS lets them read/delete; the tenant never gets a read
// path back. Service role is required because anon has no grants on any of
// these tables — that is deliberate.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_FILES = 6;
const MAX_FILE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "pdf", "xml", "zip"];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return json(400, { error: "Expected multipart form data" });
  }

  const token = String(form.get("token") ?? "");
  const fullName = String(form.get("full_name") ?? "").trim();
  const phone = String(form.get("phone") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);

  if (!/^[0-9a-f-]{36}$/i.test(token)) return json(400, { error: "Invalid link" });
  if (!fullName) return json(400, { error: "Name is required" });
  if (files.length > MAX_FILES) return json(400, { error: `At most ${MAX_FILES} files` });
  for (const f of files) {
    if (f.size > MAX_FILE_BYTES) return json(400, { error: `${f.name} is larger than 10 MB` });
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!ALLOWED_EXTENSIONS.includes(ext)) {
      return json(400, { error: `${f.name}: only jpg, png, webp, pdf, xml, zip files are allowed` });
    }
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: link } = await supabase
    .from("intake_links")
    .select("id, owner_id, property_id, status, expires_at")
    .eq("id", token)
    .maybeSingle();

  if (!link) return json(404, { error: "This link doesn't exist" });
  if (link.status !== "pending") return json(409, { error: "This link was already used" });
  if (new Date(link.expires_at) < new Date()) return json(410, { error: "This link has expired" });

  const { data: tenant, error: tenantError } = await supabase
    .from("tenants")
    .insert({
      owner_id: link.owner_id,
      full_name: fullName,
      phone: phone || null,
      email: email || null,
      kyc_status: files.length > 0 ? "submitted" : "pending",
      notes: "Self-registered via intake link",
    })
    .select("id")
    .single();

  if (tenantError) return json(500, { error: `Could not save details: ${tenantError.message}` });

  for (const f of files) {
    const safeName = f.name.replace(/[^\w.\-]/g, "_");
    const path = `${link.owner_id}/intake/${token}/${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(path, f, { upsert: true });
    if (uploadError) {
      return json(500, { error: `Could not upload ${f.name}: ${uploadError.message}` });
    }
    const { error: docError } = await supabase.from("documents").insert({
      owner_id: link.owner_id,
      property_id: link.property_id,
      doc_type: "kyc",
      title: `${fullName} — ${safeName}`,
      storage_path: path,
    });
    if (docError) {
      return json(500, { error: `Could not record ${f.name}: ${docError.message}` });
    }
  }

  const { error: linkError } = await supabase
    .from("intake_links")
    .update({ status: "submitted", tenant_id: tenant.id, submitted_at: new Date().toISOString() })
    .eq("id", token);

  if (linkError) return json(500, { error: linkError.message });

  return json(200, { ok: true });
});
