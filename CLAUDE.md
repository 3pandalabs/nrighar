# NRIGhar

Property management for NRI landlords renting out property in India — landlord/tenant two-sided platform. Part of 3PandaLabs. Live at nrighar.3pandalabs.com. (Note: a rename to "GharPass" is planned/pending — repo and code still say NRIGhar until that lands.)

Single monorepo, merged 2026-07-18 from former `nrighar-web` + `nrighar-app` repos (both histories preserved). One Postgres schema in Supabase serves both clients.

## Layout

- **`web/`** — Next.js 16 dashboard + landing page (App Router, `src/`, TS, Tailwind 4). Deployed to Vercel (Root Directory = `web`). Has its own `CLAUDE.md`/`AGENTS.md` — read those before editing here (Next.js version has breaking API/convention changes vs. training data).
- **`app/`** — Expo (React Native, SDK 57) mobile companion, read-focused (data entry happens on web). Built with EAS. Has its own `CLAUDE.md`/`AGENTS.md` — read those before editing here (Expo APIs have changed vs. training data).
- **`supabase/`** — shared backend: SQL migrations (`migrations/`, currently 0001–0008, sequential/numbered, additive style — new changes are a new numbered file, not edits to old ones) and Supabase Edge Functions (`functions/`, e.g. `tenant-intake`). Run `supabase` CLI commands from repo root, not from `web/`.
- **`brand/`** — master icon/logo SVG sources; PNGs used by `web/` and `app/` are rendered from here, not edited in place.

## Conventions

- Each client (`web/`, `app/`) is its own npm project — `npm install` and dev commands run inside that folder, not at repo root. CI is path-filtered per folder.
- Both clients read Supabase URL/anon key from env (`.env.local`, see each folder's `.env.example`); web uses `NEXT_PUBLIC_*`, app uses `EXPO_PUBLIC_*`.
- Auth/session: web via `@supabase/ssr` (route protection in `src/proxy.ts`); app via `@supabase/supabase-js` + AsyncStorage.
- DB access is RLS-gated; `automatically expose new tables` is OFF in Supabase Data API settings, so a new table needs an explicit grants migration (see `0003_grants.sql`, `0004_service_role_grants.sql`) alongside its schema migration.
- Document storage is a private Supabase Storage bucket, signed URLs only — never make it public.
