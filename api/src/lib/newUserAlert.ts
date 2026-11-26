import type { Mail } from "./mailer.js";
import { mailerConfigured, sendMail } from "./mailer.js";
import { esc } from "./emails/escape.js";

// "RentVault New user" email to the org inbox whenever someone signs up
// (2026-11-26, owner request; same shape as AdVault's lib/newUserAlert.ts).
//
// The only path that creates a users row is signupActivity (POST /auth/signup,
// owner or tenant), and that is the only caller. Not alerted: the one-off
// Supabase backfill (scripts/migrate-data.ts) and an existing email
// (signupActivity throws email_in_use before inserting). There are no seeds,
// admin-created accounts, OTP/phone or Google sign-ups in this app.
//
// Fire-and-forget: called after the signup transaction COMMITs, never awaited,
// never throws — a mailer failure only logs and can't fail, delay or (because
// it runs after the commit) cause a Temporal retry of the signup. A retried
// signupActivity re-runs into email_in_use before reaching this, so one signup
// sends at most one alert.
//
// NEW_USER_ALERT_EMAIL overrides the recipient; "off" turns the alert off.
// Sent via the shared mailer gateway as app "nrighar", same as password reset
// and contact mail (gateway's default sender for the app; no `from` here).

export function newUserAlertTo(): string | null {
  const v = process.env.NEW_USER_ALERT_EMAIL?.trim();
  if (v?.toLowerCase() === "off") return null;
  return v || "3pandas@3pandalabs.com";
}

const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim().slice(0, 200);

export type NewUser = {
  email: string;
  userId: string;
  role: "owner" | "tenant";
  displayName?: string | null;
  at?: Date;
};

export function newUserMail(to: string, u: NewUser): Mail {
  const at = (u.at ?? new Date()).toISOString().replace("T", " ").slice(0, 16) + " UTC";
  const rows: [string, string][] = [
    ["App", "RentVault"],
    ["Email", oneLine(u.email)],
    ["Role", u.role],
    ...(u.displayName?.trim() ? ([["Name", oneLine(u.displayName)]] as [string, string][]) : []),
    ["Signed up", at],
    ["User id", u.userId],
  ];
  return {
    to,
    subject: "RentVault New user",
    text: `New RentVault sign-up.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n`,
    html: `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#1f2937;max-width:560px">
  <p style="font-size:15px"><b>New RentVault sign-up</b></p>
  <table style="font-size:14px;border-collapse:collapse">${rows
    .map(([k, v]) => `<tr><td style="color:#6b7280;padding:2px 12px 2px 0">${esc(k)}</td><td>${esc(v)}</td></tr>`)
    .join("")}</table>
</div>`,
  };
}

/** Sends the alert in the background. Never throws, never awaited by the sign-up. */
export function notifyNewUser(u: NewUser, log: (msg: string) => void, send: typeof sendMail = sendMail): void {
  try {
    const to = newUserAlertTo();
    if (!to || !mailerConfigured()) return;
    void send([newUserMail(to, u)], log).catch((err) => log(`new user alert failed: ${String(err)}`));
  } catch (err) {
    log(`new user alert failed: ${String(err)}`);
  }
}
