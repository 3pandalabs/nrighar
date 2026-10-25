import { createHmac, timingSafeEqual } from "node:crypto";
import { providerEnv } from "./env.js";

// Keyed digest of a sensitive identifier (PAN, Aadhaar, BBPS consumer number).
// Used wherever we need to ask "have we seen this number before?" without
// keeping the number.
//
// HMAC rather than a bare hash, because the inputs are drawn from tiny,
// fully-enumerable keyspaces: 10^12 Aadhaar numbers, and PAN is only ~10^9
// once the format is fixed. A plain SHA-256 of either is reversible on a
// laptop, so an unkeyed digest column would leak exactly the value it was
// meant to protect. With the key held outside the database, a dump of these
// columns is inert.
export function fingerprint(value: string): string {
  const secret = providerEnv.fingerprintSecret;
  if (!secret) {
    // Refuse rather than silently degrade to an unkeyed hash. Reaching here
    // means neither KYC_FINGERPRINT_SECRET nor JWT_SECRET is set, and
    // JWT_SECRET is already required for the API to boot at all.
    throw new Error("fingerprint secret is not configured (KYC_FINGERPRINT_SECRET / JWT_SECRET)");
  }
  return createHmac("sha256", secret).update(normalize(value)).digest("hex");
}

// Case- and separator-insensitive: "abcde1234f" and "ABCDE 1234 F" are the
// same PAN and must land on the same fingerprint, or the cache misses and the
// call is paid for twice.
function normalize(value: string): string {
  return value.replace(/[\s-]/g, "").toUpperCase();
}

// Constant-time compare for anything derived from a secret (webhook
// signatures, fingerprints). Length is compared first because timingSafeEqual
// throws on a length mismatch — that leak is fine, the lengths are fixed by
// the digest algorithm anyway.
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
