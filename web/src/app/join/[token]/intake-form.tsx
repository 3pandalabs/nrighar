"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_FILES = 6;
const MAX_FILE_MB = 10;

type RpcResult = { ok?: boolean; error?: string } | null;

const RPC_ERRORS: Record<string, string> = {
  not_found: "This link doesn't exist anymore — ask your landlord for a fresh one.",
  already_used: "This link was already used.",
  expired: "This link has expired — ask your landlord for a fresh one.",
  no_tenant_profile: "This account has no renter profile — sign in with your tenant account.",
  not_signed_in: "Please sign in first.",
};

export function IntakeForm({ token }: { token: string }) {
  const [mode, setMode] = useState<"new" | "existing">("new");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [doneShareUrl, setDoneShareUrl] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function fail(message: string) {
    setError(message);
    setIsSubmitting(false);
  }

  async function acceptIntake(supabase: ReturnType<typeof createClient>): Promise<boolean> {
    const { data, error: rpcError } = await supabase.rpc("accept_intake_as_tenant", {
      p_token: token,
    });
    const result = data as RpcResult;
    if (rpcError || !result?.ok) {
      fail(RPC_ERRORS[result?.error ?? ""] ?? rpcError?.message ?? "Something went wrong.");
      return false;
    }
    return true;
  }

  async function handleNewProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const selected = Array.from(files ?? []);
    if (selected.length > MAX_FILES) return fail(`Please attach at most ${MAX_FILES} files.`);
    const tooBig = selected.find((f) => f.size > MAX_FILE_MB * 1024 * 1024);
    if (tooBig) {
      return fail(
        `${tooBig.name} is over ${MAX_FILE_MB} MB — phone photos can be large; attach a smaller version.`
      );
    }

    setIsSubmitting(true);
    const supabase = createClient();

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
    });
    if (signUpError) return fail(signUpError.message);
    const user = signUpData.user;
    if (!user || !signUpData.session) {
      return fail("Could not create your account — please try again.");
    }

    const { error: roleError } = await supabase
      .from("profiles")
      .upsert({ id: user.id, role: "tenant" });
    if (roleError) return fail(roleError.message);

    const { error: profileError } = await supabase.from("tenant_profiles").upsert({
      user_id: user.id,
      full_name: fullName.trim(),
      phone: phone.trim() || null,
      email,
      current_city: city.trim() || null,
      kyc_status: selected.length > 0 ? "submitted" : "pending",
    });
    if (profileError) return fail(profileError.message);

    for (const f of selected) {
      const path = `${user.id}/${crypto.randomUUID()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: uploadError } = await supabase.storage.from("documents").upload(path, f);
      if (uploadError) return fail(`Could not upload ${f.name}: ${uploadError.message}`);
      const { error: docError } = await supabase.from("tenant_documents").insert({
        tenant_user_id: user.id,
        doc_type: "kyc",
        title: f.name,
        storage_path: path,
      });
      if (docError) return fail(docError.message);
    }

    if (!(await acceptIntake(supabase))) return;

    // Mint a reusable open share link the tenant can give any future landlord.
    const { data: share } = await supabase
      .from("profile_shares")
      .insert({ tenant_user_id: user.id })
      .select("id")
      .single();
    if (share) {
      setDoneShareUrl(`${window.location.origin}/profile-share/${share.id}`);
    }
    setDone(true);
  }

  async function handleExisting(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
    if (signInError) return fail(signInError.message);

    if (!(await acceptIntake(supabase))) return;
    setDone(true);
  }

  if (done) {
    return (
      <div className="flex flex-col gap-4 text-center">
        <p className="text-sm font-medium text-emerald-600 dark:text-emerald-500">
          ✓ Done — your details and documents are now shared with your landlord.
        </p>
        {doneShareUrl && (
          <div className="rounded-xl border border-zinc-200 p-4 text-left dark:border-zinc-800">
            <p className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-50">
              Your renter profile is created 🎉
            </p>
            <p className="mb-2 text-xs text-zinc-500">
              Next time any landlord asks for your details, just send them your profile link
              instead of re-uploading everything:
            </p>
            <p className="break-all rounded-lg bg-zinc-100 p-2 text-xs dark:bg-zinc-900">
              {doneShareUrl}
            </p>
            <p className="mt-2 text-xs text-zinc-500">
              Manage your profile anytime at{" "}
              <a href="/tenant" className="underline">
                nrighar.3pandalabs.com/tenant
              </a>{" "}
              (sign in with the email &amp; password you just set).
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
        <button
          type="button"
          onClick={() => setMode("new")}
          className={
            mode === "new"
              ? "rounded-full bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
              : "rounded-full px-3 py-1.5 text-sm text-zinc-500"
          }
        >
          I&apos;m new here
        </button>
        <button
          type="button"
          onClick={() => setMode("existing")}
          className={
            mode === "existing"
              ? "rounded-full bg-white px-3 py-1.5 text-sm font-medium text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
              : "rounded-full px-3 py-1.5 text-sm text-zinc-500"
          }
        >
          I have a profile
        </button>
      </div>

      {mode === "new" ? (
        <form onSubmit={handleNewProfile} className="flex flex-col gap-4">
          <Field label="Full name (as on your ID)" required value={fullName} onChange={setFullName} />
          <Field label="Phone (WhatsApp)" value={phone} onChange={setPhone} placeholder="+91..." />
          <Field label="Email" required type="email" value={email} onChange={setEmail} />
          <Field
            label="Create a password (to access your profile later)"
            required
            type="password"
            value={password}
            onChange={setPassword}
          />
          <Field label="Current city" value={city} onChange={setCity} />

          <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Documents (ID proof, employment proof)
            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.webp,.pdf,.xml,.zip"
              onChange={(e) => setFiles(e.target.files)}
              className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal file:mr-3 file:rounded-full file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-zinc-800"
            />
            <span className="text-xs font-normal text-zinc-500">
              Up to 6 files, 10 MB each. Tip: your Aadhaar offline eKYC zip from
              myaadhaar.uidai.gov.in is the best ID — verifiable without revealing your full
              Aadhaar number.
            </span>
          </label>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {isSubmitting ? "Creating your profile..." : "Create profile & share with landlord"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleExisting} className="flex flex-col gap-4">
          <p className="text-sm text-zinc-500">
            Sign in to your NRIGhar renter profile — it will be shared with this landlord in one
            step, documents included.
          </p>
          <Field label="Email" required type="email" value={email} onChange={setEmail} />
          <Field label="Password" required type="password" value={password} onChange={setPassword} />
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={isSubmitting}
            className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
          >
            {isSubmitting ? "Sharing..." : "Sign in & share my profile"}
          </button>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  required,
  type,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
      {label}
      <input
        type={type ?? "text"}
        required={required}
        value={value}
        placeholder={placeholder}
        minLength={type === "password" ? 6 : undefined}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}
