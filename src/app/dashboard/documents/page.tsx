import { createClient } from "@/lib/supabase/server";
import type { DocumentRow, Property } from "@/lib/types";
import { deleteDocument } from "../actions";
import { UploadForm } from "./upload-form";

const DOC_TYPE_LABELS: Record<DocumentRow["doc_type"], string> = {
  agreement: "Rent agreement",
  kyc: "Tenant KYC",
  property_paper: "Property papers",
  tax: "Tax",
  other: "Other",
};

export default async function DocumentsPage() {
  const supabase = await createClient();

  const [{ data: documents }, { data: properties }] = await Promise.all([
    supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false })
      .returns<DocumentRow[]>(),
    supabase.from("properties").select("*").order("nickname").returns<Property[]>(),
  ]);

  const propertyById = new Map((properties ?? []).map((p) => [p.id, p]));

  const docsWithUrls = await Promise.all(
    (documents ?? []).map(async (doc) => {
      const { data } = await supabase.storage
        .from("documents")
        .createSignedUrl(doc.storage_path, 60 * 10);
      return { doc, signedUrl: data?.signedUrl ?? null };
    })
  );

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Document vault</h1>
        <p className="text-sm text-zinc-500">
          Private storage — files are only accessible to you, via short-lived links.
        </p>
      </div>

      {docsWithUrls.length > 0 ? (
        <ul className="divide-y divide-zinc-200 rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-950">
          {docsWithUrls.map(({ doc, signedUrl }) => (
            <li key={doc.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium text-zinc-900 dark:text-zinc-50">
                  {doc.title}
                </span>
                <span className="text-xs text-zinc-500">
                  {DOC_TYPE_LABELS[doc.doc_type]}
                  {doc.property_id && propertyById.get(doc.property_id)
                    ? ` · ${propertyById.get(doc.property_id)!.nickname}`
                    : ""}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-3">
                {signedUrl && (
                  <a
                    href={signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
                  >
                    Open
                  </a>
                )}
                <form action={deleteDocument}>
                  <input type="hidden" name="id" value={doc.id} />
                  <input type="hidden" name="storage_path" value={doc.storage_path} />
                  <button type="submit" className="text-red-600 hover:underline">
                    Delete
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-zinc-500">
          Nothing here yet — upload your first rent agreement or property paper below.
        </p>
      )}

      <section className="rounded-2xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-950">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Upload a document</h2>
        <UploadForm
          properties={(properties ?? []).map((p) => ({ id: p.id, nickname: p.nickname }))}
        />
      </section>
    </div>
  );
}
