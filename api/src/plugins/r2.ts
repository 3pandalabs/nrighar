import type { Readable } from "node:stream";
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../env.js";

// R2 is S3-compatible; the AWS SDK v3 client works against it unchanged by
// pointing endpoint at the account's R2 endpoint.
export const r2 = new S3Client({
  region: "auto",
  endpoint: env.R2_ENDPOINT,
  // Required for presigned PUTs. Since v3.729 the SDK defaults this to
  // "WHEN_SUPPORTED", which computes an x-amz-checksum-crc32 at *signing* time
  // — when there is no body yet — and bakes CRC32("") into the signed query
  // string. The browser then PUTs real bytes and R2 rejects the mismatch.
  requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

const UPLOAD_URL_TTL_SECONDS = 5 * 60;
const DOWNLOAD_URL_TTL_SECONDS = 10 * 60; // matches the current Supabase signed-URL TTL

export function presignUpload(key: string): Promise<string> {
  return getSignedUrl(r2, new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key }), {
    expiresIn: UPLOAD_URL_TTL_SECONDS,
  });
}

export function presignDownload(key: string): Promise<string> {
  return getSignedUrl(r2, new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }), {
    expiresIn: DOWNLOAD_URL_TTL_SECONDS,
  });
}

// Direct (non-presigned) upload — used only by the anonymous tenant-intake
// route, where the caller has no credentials of their own and the server
// itself must write the file, equivalent to the old Edge Function's
// service-role bypass.
export async function putObject(key: string, body: Buffer, contentType?: string): Promise<void> {
  await r2.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

// Server-side read of raw bytes — used by the KYC extraction activity, which
// has to hand the file to a vision model rather than a browser, so a
// presigned URL (meant for a client) doesn't apply here.
export async function getObject(key: string): Promise<{ buffer: Buffer; contentType?: string }> {
  const res = await r2.send(new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
  const stream = res.Body as Readable;
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return { buffer: Buffer.concat(chunks), contentType: res.ContentType };
}

// Best-effort object delete — called when a documents/tenant_documents row is
// deleted, so the R2 object doesn't outlive its metadata (the old Supabase
// client did storage.remove() then the metadata delete as two separate
// non-atomic calls too; this mirrors that, just server-side now).
export async function deleteObject(key: string): Promise<void> {
  await r2.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET, Key: key }));
}

// A caller may read/write a key only if it's under their own user-id prefix,
// or (for tenant documents) if they hold a claimed share for that tenant —
// checked separately via hasClaimedShare in the storage route.
export function keyOwnerUserId(key: string): string | null {
  const prefix = key.split("/")[0];
  return prefix && /^[0-9a-f-]{36}$/i.test(prefix) ? prefix : null;
}
