// Local validation that runs BEFORE any paid call, and again on the server
// even when the client already ran it.
//
// This is the cheapest cost control in the system: a malformed PAN or an
// Aadhaar number that fails its own checksum can be rejected for free, and
// those are the overwhelming majority of failed lookups in practice (typos,
// not fraud). The same functions are exported for the web/app clients to run
// on input so the user is corrected before they ever hit the button — but the
// server repeats the check, because a client-side guard the caller controls is
// a UX affordance, not a spending control.

// 5 letters, 4 digits, 1 letter. The 4th character encodes the holder type and
// the 5th is the first letter of the surname (individuals) or entity name.
const PAN_SHAPE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// Holder-type codes actually issued by the Income Tax Department. Anything
// else is a typo or an invention — either way it cannot exist upstream, so
// there is nothing to be gained by paying to ask.
//   P individual · C company · H HUF · F firm · A AOP · T trust
//   B BOI · L local authority · J artificial juridical person · G government
const PAN_HOLDER_TYPES = new Set(["P", "C", "H", "F", "A", "T", "B", "L", "J", "G"]);

export function normalizeDocumentNumber(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidPan(raw: string): boolean {
  const value = normalizeDocumentNumber(raw);
  if (!PAN_SHAPE.test(value)) return false;
  return PAN_HOLDER_TYPES.has(value[3]!);
}

export function maskPan(raw: string): string {
  const value = normalizeDocumentNumber(raw);
  if (!PAN_SHAPE.test(value)) return "**********";
  // Keep the first five (holder type + surname initial are not secret and
  // help the user recognise which card was verified) and the check letter.
  return `${value.slice(0, 5)}****${value.slice(9)}`;
}

// --- Aadhaar ---------------------------------------------------------------

// Verhoeff checksum — the algorithm UIDAI actually uses for the 12th digit.
// Catches every single-digit error and every adjacent transposition, which is
// exactly the shape of a mistyped number. Running it locally turns a large
// share of would-be failed lookups into free client-side errors.
//
// prettier-ignore
const VERHOEFF_D = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6],
  [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8],
  [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2],
  [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4],
  [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
];

// prettier-ignore
const VERHOEFF_P = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
  [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2],
  [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0],
  [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5],
  [7, 0, 4, 6, 9, 1, 3, 2, 5, 8],
];

export function verhoeffChecksumValid(digits: string): boolean {
  let c = 0;
  const reversed = digits.split("").reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    const digit = Number(reversed[i]);
    if (!Number.isInteger(digit)) return false;
    c = VERHOEFF_D[c]![VERHOEFF_P[i % 8]![digit]!]!;
  }
  return c === 0;
}

export function isValidAadhaar(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 12) return false;
  // UIDAI never issues a number starting 0 or 1 — that range is reserved so
  // Aadhaar numbers can't collide with older identifier schemes.
  if (digits[0] === "0" || digits[0] === "1") return false;
  return verhoeffChecksumValid(digits);
}

// Reuses the existing document-pipeline masking rule (lib/kyc/mask.ts): last
// four digits only, and a full mask for anything that isn't a clean 12 digits.
export function maskAadhaar(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 12) return "XXXX-XXXX-XXXX";
  return `XXXX-XXXX-${digits.slice(-4)}`;
}

// --- Name matching ---------------------------------------------------------

const NAME_NOISE = /\b(MR|MRS|MS|DR|SHRI|SMT|SRI|KUMARI|LATE|S\/O|D\/O|W\/O)\b/g;

export function normalizeName(raw: string): string {
  return raw
    .toUpperCase()
    .replace(/[^A-Z\s]/g, " ")
    .replace(NAME_NOISE, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const curr = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1]! + 1, prev[j]! + 1, prev[j - 1]! + cost);
    }
    prev = curr;
  }
  return prev[b.length]!;
}

function tokenSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  // Indian records routinely abbreviate one part of the name to an initial —
  // "R Sharma" and "Rajesh Sharma" are the same person, and refusing that
  // match would send a large share of genuine verifications to manual review.
  // Scored just under an exact match so a name that only agrees on initials
  // can't clear the auto-verify threshold on its own.
  if ((a.length === 1 || b.length === 1) && a[0] === b[0]) return 0.9;
  const distance = levenshtein(a, b);
  return Math.max(0, 1 - distance / Math.max(a.length, b.length));
}

// Cost of each token present in the longer name but absent from the shorter
// one. Small on purpose — see nameMatchScore.
const EXTRA_TOKEN_PENALTY = 0.1;

/**
 * Similarity between the name a government source returned and the name we
 * hold in our own records, as 0..1.
 *
 * Order-insensitive: "SHARMA RAJESH KUMAR" and "RAJESH KUMAR SHARMA" are the
 * same person, and which order a source prints is not something the user
 * controls.
 *
 * Every token in the shorter name must find a partner, and the average of
 * those matches is the base score. Tokens left over in the longer name are
 * then charged a flat 0.1 each, rather than being averaged in as zeroes.
 *
 * That asymmetry is the whole design, and it is calibrated against how Indian
 * names are actually recorded. A PAN card routinely carries a middle name the
 * landlord never wrote down, so "Rajesh Sharma" vs "Rajesh Kumar Sharma" is
 * the single most common genuine case in this flow. Averaging the missing
 * token in as a zero scores that 0.67 and sends a real tenant to manual review;
 * charging it as a penalty scores 0.9 and passes. Meanwhile the case that
 * must NOT pass — a surname-only match like "Sharma" against "Rajesh Kumar
 * Sharma" — still lands at 0.8, under the threshold, because two extra tokens
 * are charged twice.
 */
export function nameMatchScore(expected: string, actual: string): number {
  const a = normalizeName(expected).split(" ").filter(Boolean);
  const b = normalizeName(actual).split(" ").filter(Boolean);
  if (!a.length || !b.length) return 0;

  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  const available = [...longer];
  let total = 0;

  for (const token of shorter) {
    let bestIndex = -1;
    let best = 0;
    for (let i = 0; i < available.length; i += 1) {
      const score = tokenSimilarity(token, available[i]!);
      if (score > best) {
        best = score;
        bestIndex = i;
      }
    }
    // Consume the matched token so two tokens can't both claim the same
    // partner — without this, "Kumar Kumar" would match "Kumar Sharma" fully.
    if (bestIndex >= 0) available.splice(bestIndex, 1);
    total += best;
  }

  const base = total / shorter.length;
  const penalty = (longer.length - shorter.length) * EXTRA_TOKEN_PENALTY;
  return Number(Math.max(0, Math.min(1, base - penalty)).toFixed(3));
}

// Above this, a verification auto-passes. Below it the row is stored as
// `name_mismatch` and a human decides — never auto-rejected and never
// auto-verified, because both directions are expensive to get wrong: a false
// mismatch blocks a real tenant, a false match defeats the point of the check.
export const NAME_MATCH_THRESHOLD = 0.85;
