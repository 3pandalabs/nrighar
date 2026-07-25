import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify, { type FastifyError } from "fastify";
import { serializerCompiler, validatorCompiler, type ZodTypeProvider } from "fastify-type-provider-zod";
import { env } from "./env.js";
import { authPlugin } from "./auth/plugin.js";
import { authRoutes } from "./routes/auth.js";
import { profileRoutes } from "./routes/profile.js";
import { propertyRoutes } from "./routes/properties.js";
import { tenantRoutes } from "./routes/tenants.js";
import { leaseRoutes } from "./routes/leases.js";
import { rentPaymentRoutes } from "./routes/rentPayments.js";
import { documentRoutes } from "./routes/documents.js";
import { tenantProfileRoutes } from "./routes/tenantProfile.js";
import { tenantSharedRoutes } from "./routes/tenantShared.js";
import { payLinkRoutes } from "./routes/payLinks.js";
import { intakeLinkRoutes } from "./routes/intakeLinks.js";
import { profileShareRoutes } from "./routes/profileShares.js";
import { storageRoutes } from "./routes/storage.js";
import { tenantIntakeRoutes } from "./routes/tenantIntake.js";
import { listingRoutes } from "./routes/listings.js";
import { applicationRoutes } from "./routes/applications.js";
import { metricsRoutes } from "./routes/metrics.js";
import { recordRequest, startCpuSampler } from "./metrics/collector.js";

const app = Fastify({ logger: true }).withTypeProvider<ZodTypeProvider>();
app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(cors, { origin: env.CORS_ORIGINS, credentials: true });
await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 6 } });
await app.register(authPlugin);

app.get("/health", async () => ({ ok: true }));

// Feeds the rolling requests-per-hour figure behind GET /metrics. Both ops
// endpoints are excluded so dashboard polling and health checks don't register
// as app traffic.
startCpuSampler();
app.addHook("onResponse", async (req) => {
  if (req.url !== "/metrics" && req.url !== "/health") recordRequest();
});

// Postgres unique_violation (e.g. the one-active-lease-per-property partial
// index, or a race on any other unique constraint) should surface as a clean
// 409, not an unhandled 500.
app.setErrorHandler((err: FastifyError & { code?: string }, _req, reply) => {
  if (err.code === "23505") {
    return reply.code(409).send({ error: "conflict" });
  }
  app.log.error(err);
  return reply.code(err.statusCode ?? 500).send({ error: "internal_error" });
});

await app.register(authRoutes);
await app.register(profileRoutes);
await app.register(propertyRoutes);
await app.register(tenantRoutes);
await app.register(leaseRoutes);
await app.register(rentPaymentRoutes);
await app.register(documentRoutes);
await app.register(tenantProfileRoutes);
await app.register(tenantSharedRoutes);
await app.register(payLinkRoutes);
await app.register(intakeLinkRoutes);
await app.register(profileShareRoutes);
await app.register(storageRoutes);
await app.register(tenantIntakeRoutes);
await app.register(listingRoutes);
await app.register(applicationRoutes);
await app.register(metricsRoutes);

app.listen({ port: env.PORT, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
