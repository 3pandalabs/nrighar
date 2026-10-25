import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { providerEnv } from "./env.js";

// Envelope encryption for the handful of values that have to travel from an
// HTTP route to a Temporal activity but must not be readable in between.
//
// The problem this solves is specific to how this app is built. Since PR #8
// every route hands off to a workflow, and Temporal persists a workflow's
// input arguments in its event history — which is stored on the Temporal
// server, replayed on every worker restart, and rendered in plain text in the
// Temporal UI (which is behind Cloudflare Access, but that is one control, and
// an Aadhaar number is not a value to protect with one control). Retention on
// that history is measured in days regardless of what the request itself did.
//
// So a raw Aadhaar number, PAN, or OTP is never passed as a workflow argument.
// The route seals it; the sealed blob is what lands in the history; only the
// activity — which runs in the worker process, holds the key, and writes no
// history of its own — can open it. Everything the workflow itself needs to
// branch on (validity, masked form, fingerprint) is computed before sealing
// and passed alongside in the clear.
//
// The alternative is a Temporal PayloadCodec, which encrypts every payload for
// every workflow in the app. That is the more thorough answer and a reasonable
// thing to adopt later; it is also a change to the serialization of twenty
// existing workflow families at once, which is not a change worth coupling to
// this feature.

const KEY_INFO = Buffer.from("nrighar-sealed-field-v1");
const IV_BYTES = 12; // GCM standard
const TAG_BYTES = 16;

function key(): Buffer {
  const secret = providerEnv.fingerprintSecret;
  if (!secret) {
    throw new Error("sealed-field secret is not configured (KYC_FINGERPRINT_SECRET / JWT_SECRET)");
  }
  // HKDF so this key is domain-separated from the fingerprint HMAC even though
  // both derive from the same configured secret — reusing one key for two
  // purposes is how a weakness in either becomes a weakness in both.
  return Buffer.from(hkdfSync("sha256", Buffer.from(secret), Buffer.alloc(0), KEY_INFO, 32));
}

/** AES-256-GCM. Output is base64url of iv || tag || ciphertext. */
export function seal(plaintext: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString("base64url");
}

export function open(sealed: string): string {
  const raw = Buffer.from(sealed, "base64url");
  if (raw.length <= IV_BYTES + TAG_BYTES) throw new Error("sealed value is truncated");
  const iv = raw.subarray(0, IV_BYTES);
  const tag = raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES);
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  // GCM authenticates: a tampered blob throws here rather than decrypting to
  // an attacker-chosen number.
  return Buffer.concat([decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)), decipher.final()]).toString("utf8");
}
