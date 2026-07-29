import Link from "next/link";
import { notFound } from "next/navigation";
import { apiFetch, ApiError } from "@/lib/api/client";
import type { ListingPhoto } from "@/lib/types";

// Full gallery for one listing. The API serves these only while the listing is
// open, so a closed listing 404s here even if a tenant kept the link.
export default async function ListingPhotosPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let photos: ListingPhoto[];
  try {
    photos = ((await apiFetch(`/listings/${id}/photos`)) as ListingPhoto[]) ?? [];
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 403)) notFound();
    throw e;
  }

  if (photos.length === 0) notFound();

  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link href="/tenant/listings" className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50">
          &larr; Back to listings
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Photos</h1>
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {photos.map((photo, index) => (
          <li key={photo.id} className="overflow-hidden rounded-2xl border border-zinc-200 dark:border-zinc-800">
            {/* Presigned, short-lived URL — see the note in the browse page. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photo.url} alt={photo.caption ?? `Photo ${index + 1}`} className="w-full object-cover" />
            {photo.caption && <p className="px-4 py-3 text-sm text-zinc-600 dark:text-zinc-400">{photo.caption}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
