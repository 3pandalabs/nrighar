import { env } from "../../env.js";
import type { Mail } from "../mailer.js";
import { esc } from "./escape.js";

/**
 * Contact-page message, delivered to the support inbox.
 *
 * The sender is an anonymous visitor, so their address goes in `replyTo` and
 * never in `from` — the gateway sends as RentVault's own verified sender, and
 * spoofing a stranger's address there would fail SPF/DKIM and poison the
 * domain's reputation. Answering the mail still lands in their inbox.
 */
export function buildContactMessageEmail(input: {
  name: string;
  email: string;
  message: string;
}): Mail {
  const { name, email, message } = input;

  return {
    to: env.SUPPORT_EMAIL,
    replyTo: email,
    subject: `RentVault contact form — ${name}`,
    text: [`From: ${name} <${email}>`, "", message].join("\n"),
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b;max-width:560px;">
  <p style="font-size:13px;color:#71717a;margin:0 0 16px;">From ${esc(name)} &lt;${esc(email)}&gt;</p>
  <div style="font-size:15px;line-height:1.6;white-space:pre-wrap;">${esc(message)}</div>
</div>`,
  };
}
