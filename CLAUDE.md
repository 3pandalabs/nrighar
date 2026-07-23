# NRIGhar

Property management for NRI landlords renting out property in India — landlord/tenant two-sided platform. Part of 3PandaLabs. Live at nrighar.3pandalabs.com. (Note: a rename to "GharPass" is planned/pending — repo and code still say NRIGhar until that lands.)

Single monorepo, merged 2026-07-18 from former `nrighar-web` + `nrighar-app` repos (both histories preserved). Backend migrated off Supabase to a self-hosted `api/` service on Hetzner/Coolify (2026-07-22); the original Supabase project is paused, not deleted.

## Layout

- **`web/`** — Next.js 16 dashboard + landing page (App Router, `src/`, TS, Tailwind 4). Deployed to Cloudflare Workers via `@opennextjs/cloudflare` (not Vercel — that project is a decommission-candidate, git integration disconnected). Has its own `CLAUDE.md`/`AGENTS.md` — read those before editing here (Next.js version has breaking API/convention changes vs. training data).
- **`app/`** — Expo (React Native, SDK 57) mobile companion, read-focused (data entry happens on web). Built with EAS; `preview`/`production` EAS environments carry `EXPO_PUBLIC_API_URL` (set via `eas env:set`, not `.env.local` — that's gitignored and only used for local dev). Has its own `CLAUDE.md`/`AGENTS.md` — read those before editing here (Expo APIs have changed vs. training data).
- **`api/`** — self-hosted backend: Fastify + Drizzle ORM, JWT auth, deployed to Coolify on the shared Hetzner box (`nrighar-coolify-fsn`, Falkenstein). Replaces Supabase's Auth+PostgREST+RLS+Storage — every RLS policy/RPC from the old stack was reimplemented as an explicit route/authz check here. Schema migrations live in `api/drizzle/`, not `supabase/migrations/`. See `api/ROUTES.md` for the full route inventory. `api/src/temporal/` is a separate Temporal worker (own Coolify resource, `Dockerfile.worker`, no HTTP port) that polls the shared Temporal server for durable/background workflows — see `infra/coolify-setup.md` §8. Currently scaffolding-only (`pingWorkflow`/`ping` activity prove connectivity); real workflows (WhatsApp reminders, payment reconciliation) land here later.
- **`supabase/`** — LEGACY, historical only. SQL migrations (`migrations/`, 0001–0008) and Edge Functions (`functions/`, e.g. `tenant-intake`) from before the 2026-07-22 migration — `api/src/routes/tenantIntake.ts` is a direct port of `supabase/functions/tenant-intake/index.ts`. Don't add new migrations here; new schema changes go in `api/drizzle/`.
- **`infra/`** — Hetzner/Coolify provisioning runbook (`coolify-setup.md`, `hetzner/`) and Cloudflare R2 setup (`r2-setup.md`). Shared location even though the box now serves multiple 3PandaLabs apps.
- **`brand/`** — master icon/logo SVG sources; PNGs used by `web/` and `app/` are rendered from here, not edited in place.

## Conventions

- Each client (`web/`, `app/`, `api/`) is its own npm project — `npm install` and dev commands run inside that folder, not at repo root. CI is path-filtered per folder.
- `web/` reads `NEXT_PUBLIC_API_URL` (public, browser-facing) and `INTERNAL_API_URL` (server-side only, points at `api-internal.nrighar.3pandalabs.com` — avoids a Cloudflare Worker-to-Worker "orange-to-orange" 403 that hits the public hostname); `app/` reads `EXPO_PUBLIC_API_URL` — always the public hostname, never `-internal` (that one's firewalled to Cloudflare's IP ranges only, direct client traffic can't reach it).
- Auth: `api/` issues short-lived JWT access tokens + refresh tokens. `web/` never exposes tokens to browser JS — stored in httpOnly cookies, set from Server Actions only (see `web/src/lib/api/client.ts`). `app/` stores tokens in `expo-secure-store`, not `AsyncStorage` (deliberate — this app handles Aadhaar KYC data).
- Document storage is Cloudflare R2 (bucket `nrighar-documents`), accessed via presigned URLs issued by `api/` — never made public.
- `ops/tech-stack.md` in the private `3pandalabs/ops` repo is the source of truth for current live infra (server IPs, DNS, deployment status); this file only orients you around the code layout.
