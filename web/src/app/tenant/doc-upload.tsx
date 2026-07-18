"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DOC_TYPES = [
  ["kyc", "ID / KYC"],
  ["agreement", "Rent agreement"],
  ["tax", "Tax"],
  ["other", "Other"],
] as const;

export function TenantDocUpload() {
  const router = useRouter();
  const [file, setFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<string>("kyc");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setError(`${file.name} is over 10 MB — please choose a smaller file.`);
      return;
    }
    setError(null);
    setIsUploading(true);

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Not signed in.");
      setIsUploading(false);
      return;
    }

    const storagePath = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(storagePath, file);

    if (uploadError) {
      setError(uploadError.message);
      setIsUploading(false);
      return;
    }

    const { error: insertError } = await supabase.from("tenant_documents").insert({
      tenant_user_id: user.id,
      doc_type: docType,
      title: file.name,
      storage_path: storagePath,
    });

    setIsUploading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }

    setFile(null);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        File
        <input
          type="file"
          required
          accept=".jpg,.jpeg,.png,.webp,.pdf,.xml,.zip"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal file:mr-3 file:rounded-full file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-zinc-800"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Type
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value)}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal dark:border-zinc-700 dark:bg-zinc-900"
        >
          {DOC_TYPES.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={isUploading || !file}
        className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {isUploading ? "Uploading..." : "Upload"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
