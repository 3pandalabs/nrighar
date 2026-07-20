# Coolify setup — Postgres + nrighar-api + backups

Run this after `hetzner/provision-server.sh` (or manual provisioning) has given you a running server with its public IPv4, and after `r2-setup.md` has given you R2 credentials (the Postgres backup step below needs them).

## 1. Install Coolify

SSH in (Hetzner Ubuntu images log in as `root`, not `ubuntu`), then:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

Installs Docker + Coolify's own stack. Takes a few minutes. When done it prints a URL like `http://<public-ip>:8000` — open it immediately and create the admin account (this endpoint has no auth until the first account is created). Consider restricting port 8000 in the firewall to your IP once setup is done, the same way port 22 is restricted, since it's a full admin panel.

## 2. Add the Postgres database resource

Dashboard → **Projects** → (create or pick a project, e.g. "NRIGhar") → **New Resource → Database → PostgreSQL** → version **17**.

- Name: `nrighar-postgres`
- Let Coolify generate the password — click into the resource once created and copy the **internal connection string** (Docker-network hostname, not a public IP/port — Coolify won't expose a public port unless you toggle one, leave it off).
- Start the resource.

This connection string is `DATABASE_URL` for `nrighar-api` (step 4).

## 3. Configure scheduled backups to R2

Still inside the Postgres resource: **Backups** tab → **Add Scheduled Backup**.

- **S3-compatible storage target:** use the R2 credentials from `r2-setup.md`.
  - Endpoint: `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`
  - Access key / secret key: the R2 API token pair
  - Bucket: use a **separate bucket** from the documents bucket — create `nrighar-backups` in the same Cloudflare account (cheap, and keeps "user files" and "DB backups" blast-radius separate; don't reuse `nrighar-documents` with a prefix, a bucket-level access mistake on one shouldn't touch the other).
- **Schedule:** daily is a reasonable starting cadence for an app this size; tighten later if write volume grows.
- **Retention:** keep Coolify's default unless you have a specific reason to change it; review it once real data exists.

Do a manual "Backup now" immediately after setting this up and confirm the object actually lands in the `nrighar-backups` bucket before trusting the schedule.

## 4. Add the nrighar-api application resource

Same project → **New Resource → Application** → **Public Repository** (or connect GitHub if you want auto-deploy on push — recommended once this is stable):

- Repository: `https://github.com/3pandalabs/nrighar`
- Branch: `main`
- **Build Pack:** Dockerfile
- **Base Directory / Build Context:** `api`
- **Dockerfile location:** `Dockerfile` (relative to Base Directory, which is already `api` — do NOT repeat it here as `api/Dockerfile`, that resolves to `api/api/Dockerfile` and fails the build with a "no such file or directory" error; hit this exact bug 2026-07-20)

**Domains:** set `api.nrighar.3pandalabs.com`. Coolify's Traefik will request a Let's Encrypt certificate automatically the first time it's deployed — this requires the DNS A record (see `infra/README.md` step 6) to already resolve to this box, or the ACME HTTP-01 challenge fails. Do DNS first, then deploy.

**Environment Variables** (Coolify's per-resource env var UI, marked secret where noted):

| Key | Value | Secret? |
|---|---|---|
| `DATABASE_URL` | internal connection string from step 2 | yes |
| `JWT_SECRET` | `openssl rand -base64 48` — generate fresh, don't reuse anything from Supabase | yes |
| `R2_ACCOUNT_ID` | from `r2-setup.md` | no |
| `R2_ACCESS_KEY_ID` | from `r2-setup.md` | yes |
| `R2_SECRET_ACCESS_KEY` | from `r2-setup.md` | yes |
| `R2_BUCKET` | `nrighar-documents` | no |
| `R2_ENDPOINT` | `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` | no |
| `PORT` | `3000` (match the Dockerfile's `EXPOSE`) | no |

Deploy. Once healthy, `https://api.nrighar.3pandalabs.com/health` should return `200`.

## 5. Ongoing

- Enable Coolify's GitHub integration for auto-deploy-on-push to `main` once you're past the initial cutover and confident in the pipeline — manual deploys are fine/safer for the first few iterations.
- Coolify itself also updates periodically — check its own update notification in the dashboard occasionally; don't let it drift too far behind.
