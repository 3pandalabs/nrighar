# nrighar-web

NRIGhar — property management for NRI landlords renting out property in India. Web dashboard + marketing landing page, built with Next.js 16, Tailwind 4, and Supabase.

Part of [3PandaLabs](https://3pandalabs.com). Companion mobile app: [nrighar-app](https://github.com/3pandalabs/nrighar-app).

## What it does (MVP)

- **Properties & tenants** — add properties, tenants, and leases (rent, deposit, due day).
- **Rent tracking** — monthly ledger per lease, mark received, INR plus approximate home-currency view, one-tap WhatsApp rent reminders.
- **Document vault** — rent agreements, tenant KYC, and property papers in a private Supabase Storage bucket (signed URLs only).

## Stack

- Next.js 16 (App Router, `src/`, TypeScript), Tailwind CSS 4
- Supabase (Postgres + RLS, Auth, Storage) via `@supabase/ssr`
- Session refresh + route protection in `src/proxy.ts`
- Deployed on Vercel

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the Supabase project URL + anon key
npm run dev
```

## Database

Migrations live in `supabase/migrations/` (schema, private `documents` storage bucket, explicit grants). Apply them to the Supabase project with the Supabase CLI (`supabase db push`) or by pasting into the SQL editor in order.

Note: the project keeps "automatically expose new tables" OFF in the Data API settings — `0003_grants.sql` grants exactly what the RLS policies allow.

## Checks

```bash
npm run lint
npm run typecheck
npm run build
```
