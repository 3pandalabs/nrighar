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

**First, register R2 as an S3 Storage destination in Coolify's global Storages section** (main nav / team settings → **S3** or **Storages** — NOT inside the Postgres resource itself). The Postgres resource's own Backups tab only lets you *pick* an already-validated S3 Storage ("No validated S3 Storages found" if you try to configure a backup before this step exists — hit this 2026-07-20). Add New S3 Storage: Region `auto`, Endpoint `https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com`, Key/Secret from `r2-setup.md`, Bucket `nrighar-backups`. Confirm it shows `is_usable`/validated before moving on.

Then, inside the Postgres resource: **Backups** tab → **Add Scheduled Backup**.

- **S3-compatible storage target:** select the S3 Storage you just registered above.
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

**Domains:** set **`https://api.nrighar.3pandalabs.com`** — include the `https://` scheme. Entering just the bare hostname (`api.nrighar.3pandalabs.com`, no scheme) generates a broken Traefik rule (`Host(\`\`) && PathPrefix(\`api.nrighar.3pandalabs.com\`)` — domain lands in the path matcher with an empty Host), so no cert ever gets requested and Traefik falls back to serving its default self-signed cert. Hit this exact bug 2026-07-20; confirmed via `docker logs coolify-proxy`. Coolify's Traefik will request a Let's Encrypt certificate automatically the first time it's deployed with the domain entered correctly — this requires the DNS A record (see `infra/README.md` step 6) to already resolve to this box, or the ACME HTTP-01 challenge fails. Do DNS first, then deploy.

**Ports Exposes (General page):** Coolify defaults new resources to `3000` — change this to **`8080`** to match the Dockerfile's `EXPOSE 8080` / the `PORT` env var below. Mismatched here causes "bad gateway"/no-server errors even though the build succeeds (hit this 2026-07-20).

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

## 6. Cloudflare proxy in front of the origin (2026-07-20)

**Correction to step 4 above:** despite this doc originally saying to add the `api.nrighar.3pandalabs.com` A record as DNS-only, it was actually already set to **Proxied** (orange cloud) — found this out when revisiting the setup, not something that was deliberately flipped and documented at the time. Don't trust the "DNS-only" framing above; check the actual toggle in the Cloudflare dashboard (DNS → Records) if it matters for what you're doing.

Since the origin was already receiving proxied traffic, the origin's firewall being open to `0.0.0.0/0` on 80/443 meant anyone could bypass Cloudflare's WAF/DDoS protection entirely by hitting the Hetzner IP directly. Closed that gap:

- **SSL/TLS mode** → set to **Full (strict)** in Cloudflare (SSL/TLS → Overview). Requires the origin to present a CA-trusted cert — Traefik's existing Let's Encrypt cert (issued via HTTP-01, apparently still working fine through the proxy) already qualified, so this was a no-downtime change. Verified via `curl` immediately after.
- **ACME challenge switched from HTTP-01 to DNS-01**, so cert renewal doesn't depend on Let's Encrypt reaching the origin directly (more robust than relying on HTTP-01 tunneling through Cloudflare's proxy, which happened to work but isn't guaranteed). Edited `/data/coolify/proxy/docker-compose.yml` via Coolify's Proxy → Configuration tab:
  - Added `environment: CF_DNS_API_TOKEN: '<token>'` to the `traefik` service.
  - Replaced `--certificatesresolvers.letsencrypt.acme.httpchallenge=true` / `.httpchallenge.entrypoint=http` with `--certificatesresolvers.letsencrypt.acme.dnschallenge=true` / `.dnschallenge.provider=cloudflare`.
  - Token: Cloudflare → My Profile → API Tokens → Create Token → "Edit zone DNS" template, scoped to the `3pandalabs.com` zone only (`Zone:DNS:Edit` + `Zone:Zone:Read`, the latter needed so the Cloudflare DNS provider can look up the zone ID), IP-filtered to the Hetzner server's own IP (`Is in` → server IP) so the token is useless if leaked anywhere else.
  - This doesn't retroactively re-issue the current cert — DNS-01 only gets exercised on the next renewal or for a new hostname. **Gotcha (2026-07-21): clicking "Save" on the Proxy → Configuration editor only writes `docker-compose.yml` to disk — it does NOT restart the Traefik container.** Traefik only reads its static config (the `command:` args, including `httpchallenge` vs `dnschallenge`) at process startup, so this DNS-01 edit sat unapplied for hours — Traefik kept issuing certs via the old HTTP-01 path the whole time, and nothing in the UI signals this until you try to save again and see "Configuration Out of Sync — restart the proxy to apply your changes." After any edit to this file, always click **Restart Proxy** (top right), not just Save.
  - **Do NOT** try to drop a raw cert/key file into Proxy → Dynamic Configurations to solve this a different way — that editor is YAML-only and silently reformats/corrupts non-YAML content (also auto-appends `.yaml` to whatever filename you give it). Hit this 2026-07-20; the resulting file (`api-nrighar.pem.yaml`) broke Traefik's file-provider watcher (logged `yaml: unmarshal errors` on every reload) until deleted.
- **Hetzner firewall**: replaced the `http-acme-challenge` and `https-traefik` rules' source IPs from `0.0.0.0/0` / `::/0` to Cloudflare's published ranges (`cloudflare.com/ips-v4` and `/ips-v6` — fetch fresh when redoing this, they do change occasionally). Used `hcloud firewall replace-rules --rules-file <file> nrighar-coolify-fw` since there's no in-place "edit source IPs" command. Verified immediately after: `https://api.nrighar.3pandalabs.com/health` still 200 via Cloudflare, direct connection to the origin IP on 443 now refused.
- A Cloudflare Origin CA certificate was generated for `*.nrighar.3pandalabs.com` during this work before landing on the DNS-01 approach instead — it's unused, harmless to leave sitting in Cloudflare's Origin Certificates list (SSL/TLS → Origin Server).
- Coolify's own realtime/websocket service (powers the web Terminal and live dashboard updates) binds to `127.0.0.1:6001` on the host — it is **not** reachable externally no matter what the firewall allows, so the `coolify-realtime-admin-only` firewall rule (port 6001, added while debugging this) doesn't actually fix "Terminal websocket connection lost." Left the rule in place since it's harmless (admin-IP-only, matches the port 8000 pattern) but don't expect it to fix the terminal — that needs SSH or a different fix to Coolify's own docker-compose (out of scope here, not investigated further).

## 7. Cloudflare "orange-to-orange": nrighar-web can't call api.nrighar.3pandalabs.com directly (2026-07-21)

`nrighar-web` is a Cloudflare Worker (via `@opennextjs/cloudflare` — see `web/wrangler.jsonc`; this superseded whatever the org-level doc says about Vercel, at some point not documented here). Its server-side code (`web/src/lib/api/client.ts`, used by Server Actions/Components) needs to call `nrighar-api` at `api.nrighar.3pandalabs.com` — but that hostname is *also* Cloudflare-proxied, on the *same account*. Cloudflare blocks this "orange-to-orange" (O2O) pattern at a platform layer that sits **before** WAF/security-rule evaluation — a same-account Worker calling another proxied hostname on the same account gets rejected outright. This is a known, longstanding Cloudflare platform limitation, not a misconfiguration; there's no zone setting or WAF rule that fixes it (confirmed: a WAF custom rule matching `cf.worker.upstream_zone` saw `0` events on a failing request — it was never reached).

Symptom in the app: `apiLogin`/`apiFetch` (server-side only) intermittently got `403`s with no useful body, or a generic runtime `Error` that didn't even parse as the app's own `ApiError` type. A `cf: { resolveOverride: apiHost }` fetch option (still referenced in git history) was an earlier, insufficient attempt at a fix — it addresses a *different* Workers restriction (a Worker outright refusing to fetch its own zone) but not the O2O block on a same-*account* different-zone-looking-but-really-same-account hostname.

**Fix: give server-side calls a second, DNS-only hostname that never touches Cloudflare's proxy layer.**

- Added `api-internal.nrighar.3pandalabs.com` — same A record (`5.223.94.207`), but **DNS only** (grey cloud), in Cloudflare DNS. A Worker fetching an unproxied hostname is a plain external HTTP request as far as Cloudflare's platform is concerned, so O2O doesn't apply.
- Added that same hostname as an **additional Domain** on the `nrighar-api` Coolify resource (Configuration → Domains, comma-separated alongside the existing `https://api.nrighar.3pandalabs.com`) — without this, Traefik has no router for the hostname and DNS-01 has nothing to attach the cert to. Requires a redeploy of `nrighar-api` (not just Save) to take effect.
- `web/src/lib/api/client.ts` and `web/src/lib/api/public.ts`: `API_URL` now reads `process.env.INTERNAL_API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8080"`. `INTERNAL_API_URL` is deliberately **not** `NEXT_PUBLIC_`-prefixed, so Next.js inlines it as `undefined` in the browser bundle — genuine browser-side calls (not O2O-affected at all, since a real browser isn't a same-account Worker) correctly fall through to the public hostname. Removed the now-unneeded `resolveOverride` hack from `rawFetch`.
- `web/wrangler.jsonc`: added `INTERNAL_API_URL: "https://api-internal.nrighar.3pandalabs.com"` to `vars`.
- Removed the `--certificatesresolvers.letsencrypt.acme.dnschallenge` config's dependency on HTTP-01 reachability entirely — DNS-01 (see section 6) is what let this new hostname get a cert at all, since it's unproxied and Let's Encrypt's HTTP-01 validators would otherwise need direct access blocked by the firewall in section 6.

**Getting the new hostname's cert actually issued took three rounds — worth knowing if this happens again:**
1. First attempt 526'd (`Invalid SSL Certificate`) — Traefik had no router/cert for `api-internal` at all yet (hadn't added the Coolify Domain yet at that point).
2. After adding the Domain: `Unable to obtain ACME certificate ... Fetching http://api-internal.../.well-known/acme-challenge/...: Timeout during connect` — Traefik was still trying **HTTP-01**, not DNS-01, despite `docker-compose.yml` on disk already saying `dnschallenge=true`. Root cause: the section-6 DNS-01 edit had only ever been *Saved*, never applied (see the Save-vs-Restart gotcha above). A real **Restart Proxy** fixed this.
3. After the restart, DNS-01 was actually attempted but failed: `dns01: time limit exceeded: ... recursive nameservers: NS 127.0.0.11:53 returned NXDOMAIN`. `127.0.0.11` is Docker's embedded per-container DNS resolver — it doesn't reliably do external recursive lookups for freshly-created records inside this container network. Verified the Cloudflare API token itself was fine throughout (temporarily added a diagnostic IP to its allowlist and confirmed both the zone lookup and a real TXT record create/delete succeeded directly against Cloudflare's API). Fix: added `--certificatesresolvers.letsencrypt.acme.dnschallenge.resolvers=1.1.1.1:53,8.8.8.8:53` to the `traefik` service's `command:` so Lego's propagation check bypasses Docker's resolver and queries public DNS directly. Another Restart Proxy, and the cert issued and login worked end-to-end.

If a future domain needs DNS-01 and hits an unexplained propagation timeout, check this resolver flag is still present before assuming it's a token/permissions problem again.

## 8. Add the nrighar-worker application resource (Temporal worker)

Background/durable workflows run in a separate process from `nrighar-api` — a Temporal worker that polls the shared Temporal server (see `ops/tech-stack.md` / [[temporal_coolify_setup]] for the server itself, already running on this same box as two Coolify Docker-Image resources: `temporal` and `temporal-ui`).

Same project → **New Resource → Application** → **Public Repository**:

- Repository: `https://github.com/3pandalabs/nrighar`, branch `main`
- **Build Pack:** Dockerfile
- **Base Directory:** `api`
- **Dockerfile location:** `Dockerfile.worker` (relative to Base Directory — not `api/Dockerfile.worker`, same gotcha as step 4)
- **No domain, no port mapping** — this process only makes outbound connections (to Temporal), it doesn't listen for inbound HTTP. Leave "Ports Exposes" alone / don't add a domain.
- **Network:** must be on the same predefined `coolify` network as the `temporal` resource (Coolify puts all resources in a project on this network by default — no action needed unless that's changed).

**Environment variables:**

| Key | Value | Secret? |
|---|---|---|
| `TEMPORAL_ADDRESS` | `<temporal container's current name>:7233` — e.g. `sqtxly19t7pnzmgj21ta0rwy-160903547475:7233` as of 2026-07-23. **Goes stale on every `temporal` redeploy** — same gotcha as `temporal-ui`'s `TEMPORAL_ADDRESS`, see [[temporal_coolify_setup]]. Check via `docker inspect <container> --format '{{json .NetworkSettings.Networks.coolify.Aliases}}'` on the box. | no |
| `TEMPORAL_NAMESPACE` | `default` | no |
| `TEMPORAL_TASK_QUEUE` | `nrighar` | no |

Deploy. Confirm it's actually polling via `docker logs <worker-container>` — should log `nrighar-worker: polling task queue "nrighar" at ...` and `Worker state changed ... state: RUNNING`, no connection errors.

**Debugging note (found 2026-07-23):** the `temporal` container was listening on its IPv6-only network address at the time (`ss -tlnp` inside the container showed `fd52:...:7233`, nothing on an IPv4 address) — connecting by container **name** works fine (Docker's embedded DNS + the SDK's dual-stack-aware resolver handle it transparently), but connecting by the container's IPv4 address from outside the `coolify` network (e.g. testing over an SSH tunnel) gets `connection refused`/`ConnectionReset`. If you need to smoke-test connectivity from off-box, tunnel to the container's IPv6 address instead (`ssh -L <port>:[<ipv6-addr>]:7233 root@<box>`), or just deploy and check logs rather than tunneling.

Local dev: there's no Temporal server in `docker-compose.dev.yml` (production-only infra). Either run `temporal server start-dev` (Temporal CLI's built-in in-memory dev server) and point `TEMPORAL_ADDRESS` at it, or tunnel to the real server as above and run `npm run worker:dev` / `npm run temporal:ping` from `api/`.
