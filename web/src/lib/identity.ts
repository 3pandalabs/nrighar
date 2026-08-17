// Client-side PAN / Aadhaar format checks.
//
// DELIBERATE DUPLICATION of api/src/lib/identity/validate.ts. `web/` and `api/`
// are separate npm projects with no shared package (see the repo CLAUDE.md), and
// standing up a workspace to share ~60 lines would be the bigger change.
//
// The API is the source of truth and re-runs every one of these checks server
// side; this copy exists purely so the user is corrected before they press the
// button. That split matters: a client-side guard is a UX affordance, never a
// spending control — the caller controls the client, so the server has to
// assume it lied. Keep the two in sync when either changes, but a drift here
// costs a worse error message, not money or a wrong verdict.

const PAN_SHAPE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

// Holder-type codes actually issued by the Income Tax Department (P individual,
// C company, H HUF, F firm, A AOP, T trust, B BOI, L local authority,
// J artificial juridical person, G government). Anything else is a typo.
const PAN_HOLDER_TYPES = new Set(["P", "C", "H", "F", "A", "T", "B", "L", "J", "G"]);

export function normalizeDocumentNumber(raw: string): string {
  return raw.replace(/[\s-]/g, "").toUpperCase();
}

export function isValidPan(raw: string): boolean {
  const value = normalizeDocumentNumber(raw);
  if (!PAN_SHAPE.test(value)) return false;
  return PAN_HOLDER_TYPES.has(value[3]!);
}

// Verhoeff — the checksum UIDAI actually uses for the 12th digit. Catches every
// single-digit error and every adjacent transposition, i.e. exactly the shape
// of a mistyped number.
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

export function isValidAadhaar(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  if (digits.length !== 12) return false;
  // UIDAI never issues a number starting 0 or 1 — that range is reserved.
  if (digits[0] === "0" || digits[0] === "1") return false;

  let c = 0;
  const reversed = digits.split("").reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    const digit = Number(reversed[i]);
    if (!Number.isInteger(digit)) return false;
    c = VERHOEFF_D[c]![VERHOEFF_P[i % 8]![digit]!]!;
  }
  return c === 0;
}

/** Display-only grouping: 1234 5678 9012. Never sent to the API in this form. */
export function formatAadhaarInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 12);
  return digits.replace(/(.{4})/g, "$1 ").trim();
}

export const KYC_STATUS_LABELS: Record<string, string> = {
  verified: "Verified",
  name_mismatch: "Name doesn't match",
  not_found: "No record found",
  failed: "Check failed",
  not_configured: "Not available yet",
  pending: "In progress",
};
