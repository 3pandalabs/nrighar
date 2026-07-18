"use client";

import { useState } from "react";

const FUNCTION_URL = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/tenant-intake`;

export function IntakeForm({ token }: { token: string }) {
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [files, setFiles] = useState<FileList | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const form = new FormData();
    form.set("token", token);
    form.set("full_name", fullName);
    form.set("phone", phone);
    form.set("email", email);
    for (const f of Array.from(files ?? [])) {
      form.append("files", f);
    }

    try {
      const res = await fetch(FUNCTION_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        body: form,
      });
      const body = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !body.ok) {
        setError(body.error ?? "Something went wrong — please try again.");
        setIsSubmitting(false);
        return;
      }
      setDone(true);
    } catch {
      setError("Network error — please check your connection and try again.");
      setIsSubmitting(false);
    }
  }

  if (done) {
    return (
      <p className="text-center text-sm font-medium text-emerald-600 dark:text-emerald-500">
        ✓ Submitted — your landlord has been notified. Thank you!
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Field label="Full name (as on your ID)" required value={fullName} onChange={setFullName} />
      <Field label="Phone (WhatsApp)" value={phone} onChange={setPhone} placeholder="+91..." />
      <Field label="Email" value={email} onChange={setEmail} type="email" />

      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Documents (ID proof, employment proof — jpg/png/pdf; Aadhaar offline eKYC zip welcome)
        <input
          type="file"
          multiple
          accept=".jpg,.jpeg,.png,.webp,.pdf,.xml,.zip"
          onChange={(e) => setFiles(e.target.files)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal file:mr-3 file:rounded-full file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-zinc-800"
        />
        <span className="text-xs font-normal text-zinc-500">
          Up to 6 files, 10 MB each. Tip: you can download your Aadhaar offline eKYC at
          myaadhaar.uidai.gov.in — it lets your landlord verify you without sharing your full
          Aadhaar number.
        </span>
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {isSubmitting ? "Submitting..." : "Submit details"}
      </button>
    </form>
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
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
      />
    </label>
  );
}
