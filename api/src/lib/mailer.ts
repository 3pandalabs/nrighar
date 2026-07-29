import { env } from "../env.js";

// Sends through the shared org email gateway (3pandalabs/mailer), not directly
// to a provider.
//
// The gateway is a Cloudflare Worker using the `send_email` binding, which
// authenticates implicitly — so no Cloudflare API token exists in this app's
// environment, in Coolify, or anywhere else. This app holds only MAILER_TOKEN,
// which grants exactly one capability: send email as nrighar's own configured
// sender address.
//
// Templates deliberately stay HERE, not in the gateway. It is a dumb transport;
// it renders nothing and knows nothing about properties, tenants or listings.
//
// This is a direct port of the same file in 3pandalabs/evitevault — kept
// byte-similar on purpose so the gateway contract is described in one shape
// across apps. The attachment support is carried over unused (RentVault sends
// no attachments yet) rather than dropped and re-derived later.

export type Attachment = {
  content: string; // base64 — the gateway decodes it for the binding
  filename: string;
  type: string;
  disposition: "inline" | "attachment";
  // Required when disposition is "inline": without it the image can't be
  // referenced by a cid: in the HTML and arrives as a dangling file. The
  // gateway rejects inline attachments that omit it.
  contentId?: string;
};

export type Mail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
  attachments?: Attachment[];
};

export type SendResult = { delivered: number; failed: number; skipped: number };

export function mailerConfigured(): boolean {
  return Boolean(env.MAILER_URL && env.MAILER_TOKEN);
}

// The gateway caps a request at 100 messages; stay well under so a bulk send is
// several modest requests rather than one that risks a timeout.
const BATCH = 50;

// Unconfigured sends are logged and counted as skipped rather than throwing.
// Every caller here is doing something else that already succeeded (a reset
// token row is written, a contact message was accepted), and failing that work
// because an ops secret is missing would be the worse outcome.
export async function sendMail(messages: Mail[], log: (msg: string) => void): Promise<SendResult> {
  if (!mailerConfigured()) {
    log(`mailer not configured — ${messages.length} message(s) not delivered`);
    return { delivered: 0, failed: 0, skipped: messages.length };
  }

  let delivered = 0;
  let failed = 0;

  for (let i = 0; i < messages.length; i += BATCH) {
    const batch = messages.slice(i, i + BATCH);
    try {
      const res = await fetch(`${env.MAILER_URL.replace(/\/$/, "")}/send`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${env.MAILER_TOKEN}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          app: "nrighar",
          messages: batch.map((m) => ({
            to: m.to,
            fromName: env.EMAIL_FROM_NAME || "RentVault",
            // `from` is omitted on purpose — the gateway defaults to this app's
            // configured sender, so the address lives in one place rather than
            // being duplicated into this app's environment.
            subject: m.subject,
            html: m.html,
            text: m.text,
            ...(m.replyTo ? { replyTo: m.replyTo } : {}),
            ...(m.attachments?.length ? { attachments: m.attachments } : {}),
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        log(`mailer gateway error ${res.status}: ${body.slice(0, 300)}`);
        failed += batch.length;
        continue;
      }

      // The gateway answers 200 with per-message outcomes even when some
      // failed — a partial failure is not a failed request.
      const result = (await res.json()) as {
        delivered: number;
        failed: number;
        results?: { to: string; ok: boolean; error?: string }[];
      };
      delivered += result.delivered;
      failed += result.failed;

      for (const r of result.results ?? []) {
        if (!r.ok) log(`mail send failed for ${r.to}: ${r.error ?? "unknown"}`);
      }
    } catch (err) {
      log(`mailer gateway unreachable: ${String(err)}`);
      failed += batch.length;
    }
  }

  return { delivered, failed, skipped: 0 };
}
