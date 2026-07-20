# Pre-merge checklist — PR #5 (Supabase → self-hosted Postgres/Coolify/Hetzner + Cloudflare)

**Do not merge `migrate/postgres-coolify-hetzner` into `main` until every item below is checked.** Vercel auto-deploys `main`, and `web/` on this branch no longer talks to Supabase at all — merging early breaks the live site at nrighar.3pandalabs.com. Work through this top to bottom; each section links to the doc with the actual commands.

## 1. Provision the Hetzner server ✅ DONE 2026-07-20

- [x] `hcloud` CLI installed and authenticated (`hcloud context create nrighar`)
- [x] Filled in `MY_IP_CIDR` and ran `infra/hetzner/provision-server.sh` (corrected two wrong assumptions while running: server type `cx22` doesn't exist in Singapore, closest available is `cpx22`; location code is `sin`, not `sin1`)
- [x] Server public IPv4: **`5.223.94.207`** (SSH: `ssh root@5.223.94.207`)

→ `infra/README.md` §1–2, `infra/hetzner/provision-server.sh`

## 2. Cloudflare R2 buckets

- [ ] Create `nrighar-documents` bucket (private)
- [ ] Create `nrighar-backups` bucket (private)
- [ ] Create a single scoped R2 API token covering both buckets (decided 2026-07-20), save Account ID / Access Key ID / Secret Access Key
- [ ] Verify the token/bucket/endpoint with the `aws s3 ls --endpoint-url ...` check in the doc

→ `infra/r2-setup.md`

## 3. Install Coolify + deploy resources

- [x] SSH into the Hetzner server (`ssh root@5.223.94.207`), ran the Coolify installer (v4.1.2) — DONE 2026-07-20
- [x] Opened `http://5.223.94.207:8000`, admin account created
- [x] Added the **Postgres 17** database resource, connection string obtained (password regenerated after being shared once — see note above)
- [x] Configured scheduled Postgres backups pointing at the `nrighar-backups` R2 bucket (S3 Storage `nrighar-r2` added under Coolify's global Storages section — note: registering the R2 destination there is a separate prerequisite step from the Postgres resource's own Backups tab, which only lets you pick an already-validated one). Manual backup triggered and confirmed successful via Coolify's own DB (`scheduled_database_backup_executions.status = success`) and job log (`App\Jobs\DatabaseBackupJob` completed cleanly, no error).
- [x] Added the **`nrighar-api`** application resource (Base Directory `api`, Dockerfile Location `Dockerfile` — NOT `api/Dockerfile`, that doubles the path), all 9 env vars set, Ports Exposes fixed from Coolify's `3000` default to `8080`
- [x] Added the DNS A record: `api.nrighar.3pandalabs.com` → `5.223.94.207`, DNS-only (grey cloud) on Cloudflare
- [x] Deployed `nrighar-api` — hit and fixed a broken Traefik rule (Domains field needs the literal FQDN, see coolify-setup.md history); confirmed valid Let's Encrypt cert (issuer Let's Encrypt, expires 2026-10-18) and `https://api.nrighar.3pandalabs.com/health` returns `200 {"ok":true}`
- [x] Confirmed port 5432 is NOT reachable from the public internet (connection timeout from an external machine)

→ `infra/coolify-setup.md`

## 4. Run the schema migration against the new Postgres

- [ ] From `api/`, run the Drizzle migration (`npm run db:migrate` or equivalent — check `api/package.json`) against the new `DATABASE_URL` to create all 13 tables before any data lands

## 5. Migrate the data

- [ ] Fill in `scripts/.env.example` → `.env` with real Supabase + new-Postgres + R2 credentials
- [ ] Dry run first (default, no `--confirm`) — inspect the row-count report
- [ ] Run for real with `--confirm` (and `--truncate-first` only if re-running after a failed attempt)
- [ ] Spot-check: a handful of documents open correctly via `POST /storage/presign-download` against the new API; one full login → dashboard → tenant-doc-view smoke test

→ `scripts/README.md`

## 6. Deploy the web frontend to Cloudflare

- [ ] `npm install` in `web/` on a clean Linux/CI environment (the local Windows dev box hit an unrelated `@ast-grep/napi` native-binding issue blocking a full local build — confirm this isn't an issue in CI)
- [ ] Run `npm run cf:preview` (or `cf:deploy` when ready) — confirm the OpenNext Cloudflare build actually completes now that `src/proxy.ts` has been removed (this was the blocker; see the PR description)
- [ ] Set `JWT_SECRET` as a Worker secret (`npx wrangler secret put JWT_SECRET`) — same value as the API's, since the web app verifies access-token signatures itself in `dashboard/layout.tsx`/`tenant/layout.tsx`
- [ ] Point the Worker at the custom domain `nrighar.3pandalabs.com` (repointing from the current Vercel CNAME — this is the moment the live site's DNS actually changes)
- [ ] Full manual smoke test against production: login (owner + tenant), dashboard CRUD, document upload/view, pay-link flow, intake-link flow, profile-share claim + revoke-then-verify-cutoff

## 7. Ship the new mobile build

- [ ] Set `EXPO_PUBLIC_API_URL` to the live API URL in EAS env config
- [ ] New EAS build (existing installed builds still point at Supabase and will break once it's decommissioned — coordinate so this doesn't ship before the API is actually live)

## 8. Only after all of the above are verified working end-to-end

- [ ] Merge PR #5 into `main`
- [ ] Decommission (pause first, don't delete immediately — keep a rollback window): the Vercel project's old deployment config, the Supabase project
- [ ] Update `tech-stack.md` in the `ops` repo to flip the new infra from "IN PROGRESS" to "LIVE" (this doc's counterpart already has the entries — see the PR that added them)
