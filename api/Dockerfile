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
# NOTE (2026-07-24): migrations are TEMPORARILY decoupled from startup. Running
# `node dist/db/migrate.js && node dist/index.js` here is correct in principle,
# but a failing migration then crash-loops the whole api (fail-fast) — which
# took prod down. Reverted to server-only start to keep the service up while we
# diagnose the migration failure. Apply migrations deliberately via
# `npm run db:migrate:prod` (compiled: `node dist/db/migrate.js`) in the
# container, confirm they succeed, THEN restore the migrate-on-start CMD.
CMD ["node", "dist/index.js"]
