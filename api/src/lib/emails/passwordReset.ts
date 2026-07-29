import { env } from "../../env.js";
import type { Mail } from "../mailer.js";
import { esc } from "./escape.js";

/**
 * The reset link is the credential — anyone holding it can take the account —
 * so the copy says plainly how long it lasts and what to do if the request
 * wasn't theirs. No account details beyond the address it was sent to: this
 * mail goes out on request from an unauthenticated caller, so it must not
 * confirm anything about the account to whoever triggered it.
 */
export function buildPasswordResetEmail(to: string, token: string, ttlMinutes: number): Mail {
  const url = `${env.WEB_ORIGIN.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(token)}`;

  return {
    to,
    subject: "Reset your RentVault password",
    text: [
      "Someone asked to reset the password for this RentVault account.",
      "",
      `Open this link to choose a new one — it works once and expires in ${ttlMinutes} minutes:`,
      url,
      "",
      "If this wasn't you, ignore this email. Your password stays as it is.",
    ].join("\n"),
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b;max-width:520px;">
  <p style="font-size:15px;line-height:1.6;">Someone asked to reset the password for this RentVault account.</p>
  <p style="margin:24px 0;">
    <a href="${esc(url)}" style="background:#18181b;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-size:15px;display:inline-block;">Choose a new password</a>
  </p>
  <p style="font-size:13px;color:#71717a;line-height:1.6;">This link works once and expires in ${ttlMinutes} minutes.</p>
  <p style="font-size:13px;color:#71717a;line-height:1.6;">If this wasn't you, ignore this email — your password stays as it is.</p>
</div>`,
  };
}
