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

## 4. Run the schema migration against the new Postgres ✅ DONE 2026-07-20

- [x] Ran the compiled `dist/db/migrate.js` directly inside the already-deployed `nrighar-api` container (`docker exec`) — no SSH tunnel needed, it already has the correct `DATABASE_URL`. Note: `npm run db:migrate` (via `tsx`) won't work against the production image itself since `tsx`/`drizzle-kit` are devDependencies, omitted by `npm ci --omit=dev` in the runtime stage — use the compiled JS instead.
- [x] Verified via `\dt` in psql: all 13 tables present (documents, intake_links, leases, pay_links, profile_shares, profiles, properties, rent_payments, sessions, tenant_documents, tenant_profiles, tenants, users)

## 5. Migrate the data ✅ DONE 2026-07-20

- [x] Filled in `scripts/.env` with real Supabase + new-Postgres (via SSH tunnel, `localhost:5433`) + R2 credentials
- [x] Dry run first — 12 tables, small dataset (3 users, 1 property, 3 leases, 3 pay_links, etc.), 3 Storage objects found
- [x] Ran for real with `--confirm` — all 12 tables migrated, all row counts matched exactly (verified independently via direct `psql` query, not just the script's own report); all 3 Storage objects copied to R2, storage_path key convention confirmed intact (`<user_id>/...`, including the intake-path variant)
- [ ] Full login → dashboard → tenant-doc-view smoke test against the live API — still pending (needs web deployed to actually click through, or a direct API-level test with a real user's credentials)

→ `scripts/README.md`

## 6. Deploy the web frontend to Cloudflare ✅ DONE 2026-07-20

- [x] Built via Docker (`node:20` Linux container, mounting `web/` with an isolated `node_modules` volume) — confirmed the `@ast-grep/napi` failure was purely a Windows-local npm optional-dependency bug (npm/cli#4828), not a real problem; the build completes cleanly on Linux, and this also proves the `src/proxy.ts` removal actually fixed the upstream OpenNext adapter bug
- [x] Deployed via `wrangler deploy` inside the same container, authenticated with a Cloudflare API token (scoped to Workers)
- [x] Custom domain `nrighar.3pandalabs.com` attached to the Worker — hit two errors along the way: "No zones match" (transient/wrong context on first attempt) then "Hostname already has externally managed DNS records" (the old Vercel CNAME had to be deleted first — this was the actual live cutover moment)
- [x] Verified: DNS resolves to Cloudflare edge IPs, `/` and `/login` return `200` served by the new Worker (`x-opennext: 1`, `Server: cloudflare` headers confirm it), unauthenticated `/dashboard` correctly redirects to `/login` (307)
- [x] Full signup → authenticated create/list → session-check round trip tested directly against the live production API with a disposable test account, all `2xx`, test data cleaned up after (one harmless residual: the test user row itself has no delete-user API route to remove it)
- [x] `JWT_SECRET` Worker secret set (`wrangler secret put`), confirmed present via `wrangler secret list`
- [ ] Full UI-level smoke test (login form → dashboard click-through → document upload/view → pay-link/intake-link/profile-share flows) — only the API layer was tested directly above; the actual web UI forms haven't been clicked through yet (no browser automation available this session)

## 7. Ship the new mobile build

- [ ] Set `EXPO_PUBLIC_API_URL` to the live API URL in EAS env config
- [ ] New EAS build (existing installed builds still point at Supabase and will break once it's decommissioned — coordinate so this doesn't ship before the API is actually live)

## 8. Only after all of the above are verified working end-to-end

- [ ] Merge PR #5 into `main`
- [ ] Decommission (pause first, don't delete immediately — keep a rollback window): the Vercel project's old deployment config, the Supabase project
- [ ] Update `tech-stack.md` in the `ops` repo to flip the new infra from "IN PROGRESS" to "LIVE" (this doc's counterpart already has the entries — see the PR that added them)
