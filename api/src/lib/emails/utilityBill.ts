import type { Mail } from "../mailer.js";
import { esc } from "./escape.js";

// Overdue-utility alert to the landlord.
//
// Sent only for a bill we positively know is UNPAID past its due date — never
// for an UNKNOWN status. An NRI landlord cannot walk over and check the meter,
// so a false alarm costs them a phone call to India and some trust in the
// product; being quiet when we aren't sure is the cheaper mistake.

function inr(amount: string): string {
  const value = Number(amount);
  if (!Number.isFinite(value)) return `INR ${amount}`;
  return `INR ${value.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "an unspecified date";
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

export function buildUtilityBillOverdueEmail(input: {
  to: string;
  landlordName: string;
  propertyNickname: string;
  category: string;
  billerName: string | null;
  consumerNumberMasked: string;
  amountDue: string;
  dueDate: string | null;
  daysOverdue: number;
  dashboardUrl: string;
}): Mail {
  const biller = input.billerName ?? input.category;
  const headline = `${input.category} bill for ${input.propertyNickname} is ${input.daysOverdue} day${input.daysOverdue === 1 ? "" : "s"} overdue`;

  return {
    to: input.to,
    subject: headline.charAt(0).toUpperCase() + headline.slice(1),
    text: [
      `Hello ${input.landlordName},`,
      "",
      `The ${input.category} bill for ${input.propertyNickname} still shows as unpaid.`,
      "",
      `Biller:   ${biller}`,
      `Account:  ${input.consumerNumberMasked}`,
      `Amount:   ${inr(input.amountDue)}`,
      `Due:      ${formatDate(input.dueDate)} (${input.daysOverdue} day(s) ago)`,
      "",
      "This is what the biller reported when RentVault last checked. If your tenant has paid since, it can take a day or two to show up.",
      "",
      input.dashboardUrl,
    ].join("\n"),
    html: `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#18181b;max-width:520px;">
  <p style="font-size:15px;line-height:1.6;">Hello ${esc(input.landlordName)},</p>
  <p style="font-size:15px;line-height:1.6;">The ${esc(input.category)} bill for <strong>${esc(input.propertyNickname)}</strong> still shows as unpaid.</p>
  <table style="font-size:14px;line-height:1.8;border-collapse:collapse;margin:16px 0;">
    <tr><td style="color:#71717a;padding-right:16px;">Biller</td><td>${esc(biller)}</td></tr>
    <tr><td style="color:#71717a;padding-right:16px;">Account</td><td>${esc(input.consumerNumberMasked)}</td></tr>
    <tr><td style="color:#71717a;padding-right:16px;">Amount</td><td><strong>${esc(inr(input.amountDue))}</strong></td></tr>
    <tr><td style="color:#71717a;padding-right:16px;">Due</td><td>${esc(formatDate(input.dueDate))} — ${input.daysOverdue} day(s) ago</td></tr>
  </table>
  <p style="margin:24px 0;">
    <a href="${esc(input.dashboardUrl)}" style="background:#18181b;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none;font-size:15px;display:inline-block;">Open RentVault</a>
  </p>
  <p style="font-size:13px;color:#71717a;line-height:1.6;">This is what the biller reported when RentVault last checked. If your tenant has paid since, it can take a day or two to show up.</p>
</div>`,
  };
}
