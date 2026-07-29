import "dotenv/config";

function required(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  PORT: Number(process.env.PORT ?? 8080),
  JWT_SECRET: required("JWT_SECRET"),
  CORS_ORIGINS: (process.env.CORS_ORIGINS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  R2_ACCOUNT_ID: required("R2_ACCOUNT_ID"),
  R2_ACCESS_KEY_ID: required("R2_ACCESS_KEY_ID"),
  R2_SECRET_ACCESS_KEY: required("R2_SECRET_ACCESS_KEY"),
  R2_BUCKET: required("R2_BUCKET"),
  R2_ENDPOINT: required("R2_ENDPOINT"),
  // Bearer token for the ops-only GET /metrics endpoint. Intentionally NOT
  // required: when unset the route answers 503 and the rest of the API boots
  // normally, so a missing ops secret can't take a deploy down.
  METRICS_TOKEN: process.env.METRICS_TOKEN ?? "",

  // Shared org email gateway (3pandalabs/mailer). Same deliberate non-required
  // treatment as METRICS_TOKEN: RentVault ran without any email at all until
  // password reset landed, so a missing mailer secret must degrade (reset
  // emails silently don't send, logged) rather than refuse to boot and take
  // rent collection down with it. See lib/mailer.ts.
  MAILER_URL: process.env.MAILER_URL ?? "",
  MAILER_TOKEN: process.env.MAILER_TOKEN ?? "",
  EMAIL_FROM_NAME: process.env.EMAIL_FROM_NAME ?? "RentVault",
  // Where password-reset links point. Not derived from the request's Host —
  // an attacker-controlled Host header would otherwise rewrite the reset link
  // in an email we send to the real account owner.
  WEB_ORIGIN: process.env.WEB_ORIGIN ?? "https://nrighar.3pandalabs.com",
  // Destination for Contact-page messages. Falls back to the org address.
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL ?? "3pandalabs@gmail.com",
};
