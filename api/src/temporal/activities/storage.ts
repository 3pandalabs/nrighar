import { ApplicationFailure } from "@temporalio/common";
import { hasClaimedShare } from "../../plugins/authz.js";
import { keyOwnerUserId, presignDownload, presignUpload } from "../../plugins/r2.js";

export async function presignUploadActivity(input: { key: string; userId: string }) {
  if (!input.key.startsWith(`${input.userId}/`)) {
    throw ApplicationFailure.create({ type: "forbidden", nonRetryable: true });
  }
  const url = await presignUpload(input.key);
  return { url };
}

// Mirrors documents_bucket_select_own + documents_bucket_select_shared: the
// caller may read a key under their own prefix, or under a tenant's prefix if
// they hold a claimed share for that tenant — the storage-layer half of the
// same check tenantShared activities apply to metadata, kept in sync via
// hasClaimedShare(), never a re-derived condition.
export async function presignDownloadActivity(input: { key: string; userId: string }) {
  const ownerUserId = keyOwnerUserId(input.key);
  if (!ownerUserId) throw ApplicationFailure.create({ type: "invalid_key", nonRetryable: true });

  const isOwnKey = ownerUserId === input.userId;
  const isSharedTenantKey = !isOwnKey && (await hasClaimedShare(ownerUserId, input.userId));
  if (!isOwnKey && !isSharedTenantKey) {
    throw ApplicationFailure.create({ type: "forbidden", nonRetryable: true });
  }
  const url = await presignDownload(input.key);
  return { url };
}
