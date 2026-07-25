# Multi-stage build: compile TypeScript in a full node image, run on a slim one.
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle

# Coolify/Traefik terminates TLS in front of this container; it only ever
# needs to listen on plain HTTP inside the private Docker network.
RUN addgroup -S nrighar && adduser -S nrighar -G nrighar
USER nrighar

EXPOSE 8080
# Migrate-on-start (restored 2026-07-25). The 2026-07-24 crash-loop that took
# prod down was migration 0002 being non-idempotent: a re-run hit
# "column already exists" and fail-fast crash-looped the whole api. All
# migrations (0002 included) are now idempotent — ADD COLUMN IF NOT EXISTS and
# DO $$ ... WHEN duplicate_object guards — so a redeploy re-applies pending
# migrations safely and self-heals the schema.
#
# migrate.js runs as the runtime role (DATABASE_URL). There is no role split in
# prod — `nrighar_app` owns the database and can run DDL. Do NOT set
# MIGRATION_DATABASE_URL to a superuser: with no default privileges configured,
# tables it created would be owned by `postgres` and unreadable by the runtime
# role. See src/db/migrate.ts for the 42501 schema-ownership gotcha.
# To apply out-of-band instead: `node dist/db/migrate.js` in the container.
CMD ["sh", "-c", "node dist/db/migrate.js && node dist/index.js"]
