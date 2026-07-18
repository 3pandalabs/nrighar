# nrighar-app

NRIGhar mobile app — property management for NRI landlords renting out property in India. Expo (React Native) companion to the [nrighar-web](https://github.com/3pandalabs/nrighar-web) dashboard; both talk to the same Supabase backend.

Part of [3PandaLabs](https://3pandalabs.com).

## What it does (MVP)

Read-focused companion for checking on your property from your phone:

- **Overview** — properties, rent expected vs collected this month.
- **Properties** — list with current tenant / vacancy status.
- **Rent** — this month's status per lease, with one-tap WhatsApp rent reminders.

Data entry (properties, tenants, leases, payments, documents) happens on the web dashboard. Database migrations also live in the nrighar-web repo (`supabase/migrations/`).

## Stack

- Expo SDK 57, expo-router, TypeScript
- Supabase (`@supabase/supabase-js`) with AsyncStorage session persistence
- EAS for builds

## Local development

```bash
npm install
cp .env.example .env.local   # fill in the Supabase project URL + anon key
npm start
```

## Checks

```bash
npm run lint
npm run typecheck
```
