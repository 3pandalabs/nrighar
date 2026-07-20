# NRIGhar infrastructure — Hetzner + Coolify runbook

Target: a single [Hetzner Cloud](https://www.hetzner.com/cloud/) server running [Coolify](https://coolify.io/), which manages two resources:
- a **Postgres 17 "Database"** resource (replaces Supabase Postgres — private, never internet-facing)
- an **`nrighar-api` "Application"** resource (the new Fastify backend, replaces PostgREST/GoTrue/Storage)

Coolify's built-in Traefik does TLS termination and routing. Deliberately no load balancer, no NAT gateway, no managed-Kubernetes control plane — that's the whole point of a plain VPS over a managed-cluster platform. (Originally scoped for AWS EC2; switched to Hetzner for materially lower cost at this scale — a Hetzner CX22 runs a few euros/month vs. the AWS on-demand equivalent, with no separate Elastic IP charge.)

## 1. Provision the server

- **Image:** Ubuntu 24.04 LTS (Coolify's officially supported OS).
- **Server type:** `cpx22` (2 vCPU, 4GB RAM, 80GB disk, shared AMD) to start — comfortably above Coolify's stated 2GB minimum, giving headroom for Postgres + the API + Coolify itself. Resize up later if it feels tight under real load; don't over-provision before you have real traffic to size against. (The Intel "cx" line, e.g. `cx23`, is not available in the Singapore region — only in the European ones — verified via `hcloud server-type list`.)
- **Location:** `sin` (Singapore) is the closest Hetzner region to India-based landlords/tenants; pick a European or US region instead if your actual user latency profile differs. Verify the current region list with `hcloud location list` — Hetzner adds/changes regions periodically.
- **SSH key:** use or register a dedicated key for this box; don't reuse a key you don't control the private half of.
- **Public IPv4:** included free with every server and stays attached for the server's lifetime — no separate "Elastic IP" step or cost, unlike AWS.

See `hetzner/provision-server.sh` for a scripted version of this (review before running — it is **not** executed automatically, and provisions real, billable Hetzner resources; requires the `hcloud` CLI authenticated against your project).

## 2. Firewall

Open **only**:
| Port | Source | Why |
|---|---|---|
| 22 (SSH) | your IP only (`/32`) | admin access — never `0.0.0.0/0` |
| 80 (HTTP) | `0.0.0.0/0` | Let's Encrypt HTTP-01 challenge + redirect to HTTPS |
| 443 (HTTPS) | `0.0.0.0/0` | Traefik-terminated traffic to `api.nrighar.3pandalabs.com` |
| 8000 (Coolify dashboard) | your IP only (`/32`) | Coolify's own admin UI, unauthenticated until the first account is created — same reasoning as SSH. Missed on the initial pass (dashboard was unreachable until this was added); `provision-server.sh` now opens it by default. |

**Do not open 5432 (Postgres) to the internet, ever.** The whole reason to self-host is to control this database — putting it on the public internet defeats that and is the single most common way self-hosted Postgres boxes get compromised. `nrighar-api` reaches Postgres over Coolify's internal Docker network (both containers on the same Docker bridge network Coolify creates), never through the public IP. If you ever need direct DB access for debugging, use an SSH tunnel (`ssh -L 5432:localhost:5432 root@<ip>`) rather than opening the port.

## 3. Install Coolify

SSH into the server (Hetzner Ubuntu images log in as `root`, not `ubuntu` like AWS), then run Coolify's official installer:

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | sudo bash
```

This installs Docker (if not present), pulls Coolify's own containers, and prints the URL (`http://<your-ip>:8000`) to finish setup in the browser — create the admin account immediately, this endpoint is unauthenticated until you do. Details/updates: [coolify.io/docs/installation](https://coolify.io/docs/installation).

## 4. Add the Postgres resource

In the Coolify dashboard: **New Resource → Database → PostgreSQL 17**.

- Give it a name (`nrighar-postgres`), let Coolify generate the password (copy it out immediately — this becomes part of `DATABASE_URL` for the API).
- Leave it **not** publicly exposed (Coolify defaults to internal-network-only unless you explicitly toggle a public port — leave that off).
- Once running, note the internal connection string Coolify shows (something like `postgres://postgres:<password>@nrighar-postgres:5432/postgres`) — this is what `nrighar-api`'s `DATABASE_URL` env var will point to (internal Docker hostname, not the public IP).
- Configure scheduled backups to R2 — see `coolify-setup.md` for the exact steps.

## 5. Add the `nrighar-api` application resource

**New Resource → Application → Public Repository / Deploy from Git**, pointing at the `nrighar` repo, build context `api/`, using `api/Dockerfile`.

Set the domain to `api.nrighar.3pandalabs.com` in the resource's "Domains" field — Coolify's Traefik will automatically request a Let's Encrypt certificate for it once DNS resolves (step 7 below must happen first, or the ACME challenge will fail).

Environment variables (see `api/.env.example` for the authoritative list):
- `DATABASE_URL` — the internal Postgres connection string from step 4
- `JWT_SECRET` — generate with `openssl rand -base64 48`, store nowhere else in plaintext except Coolify's env var store
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT` — from `r2-setup.md`
- `PORT` — whatever the Dockerfile's `EXPOSE`s (Coolify auto-detects, but set explicitly to be safe, e.g. `3000`)

## 6. DNS

Add an **A record**: `api.nrighar.3pandalabs.com` → `<server's public IPv4>`.

Set it **DNS-only (grey cloud)** on Cloudflare initially — not proxied. This matches the existing pattern for `nrighar.3pandalabs.com` (a prior incident there involved a TLS/cert issue traced to DNS-proxy-vs-origin confusion on Vercel; keeping this one DNS-only avoids the same class of problem while Traefik is issuing its own Let's Encrypt cert directly against the origin). Cloudflare proxying (orange cloud) + a Cloudflare Origin Certificate can be layered on later once the setup is verified stable — that's a deliberate follow-up, not part of this initial cutover.

## 7. Verify

- `curl -I https://api.nrighar.3pandalabs.com/health` (once the API has a health route) returns `200` with a valid cert (no `-k` needed).
- `docker ps` on the box shows the Postgres and `nrighar-api` containers healthy.
- Confirm port 5432 is *not* reachable from outside: from another machine, `nc -zv <public-ip> 5432` should time out / refuse, not connect.

## Related

- `hetzner/provision-server.sh` — scripted version of steps 1–2.
- `coolify-setup.md` — detail on steps 3–5, including the R2 backup configuration.
- `r2-setup.md` — the Cloudflare R2 bucket + credentials this all depends on (do this before step 5).
- Once live, update `tech-stack.md` in the `ops` repo with the Hetzner server ID/location, Coolify URL, and R2 bucket name — see the standing tech-stack-doc-maintenance instruction.
