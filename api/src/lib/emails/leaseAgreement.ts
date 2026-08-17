import type { Mail } from "../mailer.js";
import { esc } from "./escape.js";

// Signature-request and completion mail for the e-Sign lease flow.
//
// The signing URL is a bearer credential — whoever opens it is presented as
// the signer — so it is sent only to the address recorded for that signer, and
// the copy says plainly what the link does before the reader clicks it. No
// rent figures or addresses in the body: this mail routinely lands in an inbox
// the other party can see, and the agreement itself is behind the link.

export function buildSignatureRequestEmail(input: {
  to: string;
  signerName: string;
  counterpartyName: string;
  propertyNickname: string;
  signUrl: string;
  isFirstSigner: boolean;
}): Mail {
  const intro = input.isFirstSigner
    ? `${esc(input.counterpartyName)} is ready to sign the rental agreement for ${esc(input.propertyNickname)}, and you're up first.`
    : `${esc(input.counterpartyName)} has signed the rental agreement for ${esc(input.propertyNickname)}. It's your turn.`;

  const plainIntro = input.isFirstSigner
    ? `${input.counterpartyName} is ready to sign the rental agreement for ${input.propertyNickname}, and you're up first.`
    : `${input.counterpartyName} has signed the rental agreement for ${input.propertyNickname}. It's your turn.`;

  return {
    to: input.to,
    subject: `Sign the rental agreement for ${input.propertyNickname}`,
    text: [
      `Hello ${input.signerName},`,
      "",
      plainIntro,
      "",
      "Open this link to read the agreement and sign it with an Aadhaar OTP:",
      input.signUrl,
      "",
      "The link is personal to you — don't forward it. If you weren't expecting this, ignore this email and nothing will be signed.",
    ].join("\n"),
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b;max-width:520px;">
  <p style="font-size:15px;line-height:1.6;">Hello ${esc(input.signerName)},</p>
  <p style="font-size:15px;line-height:1.6;">${intro}</p>
  <p style="margin:24px 0;">
    <a href="${esc(input.signUrl)}" style="background:#18181b;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-size:15px;display:inline-block;">Read and sign the agreement</a>
  </p>
  <p style="font-size:13px;color:#71717a;line-height:1.6;">You'll sign with an Aadhaar OTP. The link is personal to you — please don't forward it.</p>
  <p style="font-size:13px;color:#71717a;line-height:1.6;">If you weren't expecting this, ignore this email and nothing will be signed.</p>
</div>`,
  };
}

export function buildAgreementCompletedEmail(input: {
  to: string;
  recipientName: string;
  propertyNickname: string;
  dashboardUrl: string;
}): Mail {
  return {
    to: input.to,
    subject: `The rental agreement for ${input.propertyNickname} is fully signed`,
    text: [
      `Hello ${input.recipientName},`,
      "",
      `Both parties have now signed the rental agreement for ${input.propertyNickname}.`,
      "",
      "The signed copy is stored in RentVault:",
      input.dashboardUrl,
      "",
      "Keep a copy for your records — a signed agreement is your evidence of the terms you agreed to.",
    ].join("\n"),
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b;max-width:520px;">
  <p style="font-size:15px;line-height:1.6;">Hello ${esc(input.recipientName)},</p>
  <p style="font-size:15px;line-height:1.6;">Both parties have now signed the rental agreement for <strong>${esc(input.propertyNickname)}</strong>.</p>
  <p style="margin:24px 0;">
    <a href="${esc(input.dashboardUrl)}" style="background:#18181b;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-size:15px;display:inline-block;">Open the signed agreement</a>
  </p>
  <p style="font-size:13px;color:#71717a;line-height:1.6;">Keep a copy for your records — a signed agreement is your evidence of the terms you agreed to.</p>
</div>`,
  };
}
