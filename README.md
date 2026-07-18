# NRIGhar

Property management for landlords and tenants in India — one repo, whole product.

Part of [3PandaLabs](https://3pandalabs.com). Live at [nrighar.3pandalabs.com](https://nrighar.3pandalabs.com).

## Structure

- **`web/`** — Next.js dashboard + landing page, deployed to Vercel (project Root Directory = `web`).
- **`app/`** — Expo (React Native) mobile app, built with EAS.
- **`supabase/`** — shared backend: SQL migrations and Supabase CLI config. One schema serves both clients. Run `supabase` CLI commands from the repo root.
- **`brand/`** — master icon/logo SVG sources; PNGs are rendered from here into `web/` and `app/` assets.

## Working on it

Each client is its own npm project — run `npm install` / dev commands inside `web/` or `app/`, not at the root. CI runs per-folder via path-filtered workflows.

History note: this repo was merged from the former `nrighar-web` and `nrighar-app` repos (2026-07-18); both full histories are preserved.
