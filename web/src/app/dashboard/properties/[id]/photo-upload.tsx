"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getPhotoUploadUrl, recordPropertyPhoto } from "../../actions";

const MAX_BYTES = 8 * 1024 * 1024;
const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];

// Uploads go browser -> R2 directly via a presigned PUT; only the resulting key
// is sent to the API afterwards. Same two-step flow as document upload, so a
// large file never travels through the Worker or the API container.
export function PropertyPhotoUpload({ propertyId, disabled }: { propertyId: string; disabled: boolean }) {
  const router = useRouter();
  const [files, setFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (files.length === 0) return;

    const tooBig = files.find((f) => f.size > MAX_BYTES);
    if (tooBig) {
      setError(`${tooBig.name} is over 8 MB — please choose a smaller image.`);
      return;
    }
    const wrongType = files.find((f) => !ACCEPTED.includes(f.type));
    if (wrongType) {
      setError(`${wrongType.name} isn't a JPEG, PNG or WebP image.`);
      return;
    }

    setError(null);

    // Sequential, not Promise.all: each upload is a presign round-trip plus the
    // PUT itself, and the API assigns sortOrder from the current row count —
    // uploading in parallel would race that and scramble the intended order.
    for (const [index, file] of files.entries()) {
      setProgress(`Uploading ${index + 1} of ${files.length}...`);
      try {
        const { key, url } = await getPhotoUploadUrl(propertyId, file.name.replace(/[^\w.\-]/g, "_"));
        const putRes = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
        if (!putRes.ok) throw new Error(`Could not upload ${file.name} — please try again.`);
        await recordPropertyPhoto({ propertyId, storagePath: key });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
        setProgress(null);
        router.refresh(); // keep whatever did upload before the failure
        return;
      }
    }

    setProgress(null);
    setFiles([]);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Add photos
        <input
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp"
          disabled={disabled}
          onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
          className="rounded-lg border border-zinc-300 px-3 py-2 text-sm font-normal file:mr-3 file:rounded-full file:border-0 file:bg-zinc-100 file:px-3 file:py-1 file:text-sm disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:file:bg-zinc-800"
        />
      </label>
      <button
        type="submit"
        disabled={disabled || progress !== null || files.length === 0}
        className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {progress ?? `Upload${files.length > 1 ? ` ${files.length}` : ""}`}
      </button>
      {disabled && (
        <p className="w-full text-sm text-zinc-500">
          This property already has the maximum of 20 photos. Remove one to add another.
        </p>
      )}
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
