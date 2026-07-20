# Cloudflare R2 setup

R2 replaces the Supabase Storage `documents` bucket. Two buckets total (see `coolify-setup.md` for why they're separate):
- `nrighar-documents` — user-uploaded files (owner docs, tenant KYC docs), same `<user_id>/<filename>` key convention as today.
- `nrighar-backups` — Postgres backup target (Coolify writes here, see `coolify-setup.md` step 3).

## 1. Create the buckets

Cloudflare dashboard → **R2** → **Create bucket**.

- `nrighar-documents` — default settings (private by default, which is what we want — never enable public access on this bucket, all reads go through presigned URLs issued by `nrighar-api`).
- `nrighar-backups` — same, private.

## 2. Create a scoped API token

**R2 → Manage R2 API Tokens → Create API Token.**

DECIDED (2026-07-20): **one token scoped to both buckets** — simpler to manage, acceptable tradeoff for this app's scale over splitting backup credentials from document-serving credentials.

- Permissions: **Object Read & Write**
- Bucket scope: restrict to the specific bucket(s), not "all buckets"
- TTL: no expiry needed for a service credential, but note the creation date somewhere (tech-stack.md) so it can be rotated later if ever needed

This generates:
- **Access Key ID**
- **Secret Access Key** (shown once — copy immediately)
- **Account ID** (also visible in the R2 dashboard sidebar / any bucket's "S3 API" tab)

## 3. Resulting env vars

```
R2_ACCOUNT_ID=<account id>
R2_ACCESS_KEY_ID=<access key id>
R2_SECRET_ACCESS_KEY=<secret access key>
R2_BUCKET=nrighar-documents
R2_ENDPOINT=https://<account id>.r2.cloudflarestorage.com
```

These feed `nrighar-api`'s Coolify environment variables (`coolify-setup.md` step 4) and the data migration script's env vars (`scripts/README.md`) — the migration script uses the same `nrighar-documents` bucket/credentials as the destination for copied files.

The single token's credentials go into both Coolify's Postgres backup configuration (`coolify-setup.md` step 3) and `nrighar-api`'s env — same Access Key ID/Secret for both, only the bucket name differs (`nrighar-backups` vs `nrighar-documents`).

## 4. Verify

`aws s3 ls --endpoint-url https://<account id>.r2.cloudflarestorage.com s3://nrighar-documents --profile r2` (configure a throwaway AWS CLI profile with the R2 keys) should return an empty listing with no auth error, confirming the token/bucket/endpoint combination works before wiring it into Coolify or the migration script.
