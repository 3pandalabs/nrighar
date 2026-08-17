import { createHash } from "node:crypto";
import PDFDocument from "pdfkit";

// Renders the rental agreement that gets e-Signed.
//
// Two things worth knowing before editing this file:
//
// 1. STAMP DUTY. An unstamped rental agreement is admissible in India only
//    after paying the duty and a penalty, and duty is a state matter (Karnataka
//    and Maharashtra differ, and both differ from Delhi). This generator
//    produces the *instrument*; it does not e-stamp it. Providers like
//    Leegality/SignDesk sell e-stamping as a separate paid item on the same
//    transaction, and wiring it in is a per-state commercial decision, not a
//    code one — so the document carries an explicit note saying it is unstamped
//    rather than silently implying otherwise. See ROUTES.md.
//
// 2. TYPEFACE. pdfkit's built-in Helvetica is WinAnsi-encoded and has no glyph
//    for the rupee sign (U+20B9) — it renders as garbage rather than failing,
//    which is the worst kind of bug to ship on a money document. Amounts are
//    therefore written as "INR 25,000", not "₹25,000". Changing that means
//    embedding a font with the glyph and shipping the font file with the image.

export interface AgreementTerms {
  landlord: { name: string; email: string | null; countryOfResidence: string | null };
  tenant: { name: string; email: string | null; phone: string | null };
  property: {
    nickname: string;
    addressLine1: string;
    addressLine2: string | null;
    city: string;
    state: string;
    pincode: string;
    propertyType: string;
    bedrooms: number | null;
  };
  lease: {
    rentAmount: string;
    depositAmount: string | null;
    startDate: string;
    endDate: string | null;
    rentDueDay: number;
  };
  // Set once at generation and frozen into lease_agreements.terms, so a
  // re-render of a signed agreement is byte-comparable against its hash.
  generatedOn: string;
}

const MARGIN = 56;
const BODY_SIZE = 10.5;

function inr(amount: string | null): string {
  if (!amount) return "INR 0";
  const value = Number(amount);
  if (!Number.isFinite(value)) return `INR ${amount}`;
  // en-IN grouping (1,50,000 rather than 150,000) — the reader is Indian even
  // when the landlord isn't.
  return `INR ${value.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(`${iso}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" });
}

function fullAddress(p: AgreementTerms["property"]): string {
  return [p.addressLine1, p.addressLine2, `${p.city}, ${p.state} ${p.pincode}`].filter(Boolean).join(", ");
}

// Ordinal suffix for "on or before the 5th day of each month".
function ordinal(n: number): string {
  const rem100 = n % 100;
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function monthsBetween(start: string, end: string | null): number | null {
  if (!end) return null;
  const a = new Date(`${start}T00:00:00Z`);
  const b = new Date(`${end}T00:00:00Z`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.max(0, (b.getUTCFullYear() - a.getUTCFullYear()) * 12 + (b.getUTCMonth() - a.getUTCMonth()));
}

function clauses(t: AgreementTerms): { heading: string; body: string }[] {
  const term = monthsBetween(t.lease.startDate, t.lease.endDate);
  return [
    {
      heading: "1. Premises",
      body: `The Landlord lets to the Tenant, and the Tenant takes on rent, the residential premises described as ${t.property.nickname} — ${fullAddress(t.property)} (the "Premises"), being a ${t.property.propertyType.replace(/_/g, " ")}${t.property.bedrooms ? ` of ${t.property.bedrooms} BHK` : ""}, together with the fixtures and fittings existing therein.`,
    },
    {
      heading: "2. Term",
      body: `This Agreement commences on ${formatDate(t.lease.startDate)}${
        t.lease.endDate
          ? ` and expires on ${formatDate(t.lease.endDate)}${term ? `, a term of ${term} month(s)` : ""}`
          : " and continues on a month-to-month basis until terminated in accordance with Clause 8"
      }. Continued occupation beyond the expiry without a fresh agreement shall not be construed as a renewal.`,
    },
    {
      heading: "3. Rent",
      body: `The Tenant shall pay rent of ${inr(t.lease.rentAmount)} per month, payable in advance on or before the ${ordinal(t.lease.rentDueDay)} day of each calendar month, without deduction or set-off, to the account nominated by the Landlord. Rent for a part month shall be pro-rated on a daily basis.`,
    },
    {
      heading: "4. Security deposit",
      body: t.lease.depositAmount
        ? `The Tenant has paid an interest-free refundable security deposit of ${inr(t.lease.depositAmount)}. The Landlord shall refund it within thirty (30) days of the Tenant vacating and handing over peaceful possession, after adjusting arrears of rent, unpaid utility charges, and the cost of making good any damage beyond normal wear and tear.`
        : "No security deposit has been taken under this Agreement.",
    },
    {
      heading: "5. Utilities and outgoings",
      body: "Electricity, water, gas, internet, and any usage-based charges for the Premises shall be borne by the Tenant and paid directly to the respective service providers on or before their due dates. Municipal property tax and any charges levied on ownership shall be borne by the Landlord. The Tenant shall, on request, produce evidence that utility accounts for the Premises are current.",
    },
    {
      heading: "6. Use and maintenance",
      body: "The Premises shall be used for residential purposes only, by the Tenant and the Tenant's immediate family. The Tenant shall keep the Premises in good and tenantable condition, shall not carry out structural alterations without the Landlord's prior written consent, and shall not sub-let, assign, or part with possession of the whole or any part of the Premises.",
    },
    {
      heading: "7. Landlord's access",
      body: "The Landlord, or a person authorised by the Landlord in writing, may enter the Premises to inspect its condition or to carry out repairs, having given the Tenant at least twenty-four (24) hours' prior notice, except in an emergency where no notice shall be required.",
    },
    {
      heading: "8. Termination",
      body: "Either party may terminate this Agreement by giving the other one (1) month's written notice, or one month's rent in lieu of notice. The Landlord may terminate without notice if rent remains unpaid for fifteen (15) days after its due date, or on a breach of Clause 6 which the Tenant fails to remedy within fifteen (15) days of written notice.",
    },
    {
      heading: "9. Handover",
      body: "On expiry or termination, the Tenant shall hand over vacant and peaceful possession of the Premises, together with all keys and access devices, in the same condition as at commencement, normal wear and tear excepted.",
    },
    {
      heading: "10. Governing law and jurisdiction",
      body: `This Agreement is governed by the laws of India, and the courts at ${t.property.city}, ${t.property.state} shall have exclusive jurisdiction over any dispute arising from it.`,
    },
    {
      heading: "11. Execution",
      body: "This Agreement is executed electronically by both parties using Aadhaar-based electronic signature under Section 3A of the Information Technology Act, 2000. Each party's electronic signature, together with the signing certificate issued at the time of signing, forms part of this Agreement and has the same effect as a handwritten signature.",
    },
  ];
}

/**
 * Renders the agreement and returns the bytes with their SHA-256.
 *
 * The hash is stored alongside the PDF in lease_agreements.content_hash and is
 * what makes "tamper-proof" a checkable claim rather than a marketing one: it
 * pins exactly which bytes were sent for signature, so the signed copy the
 * provider returns can be held against the document we actually authored.
 */
export async function renderAgreementPdf(terms: AgreementTerms): Promise<{ buffer: Buffer; sha256: string }> {
  const doc = new PDFDocument({
    size: "A4",
    margin: MARGIN,
    info: {
      Title: `Rental Agreement — ${terms.property.nickname}`,
      Author: "RentVault",
      Subject: `Residential rental agreement between ${terms.landlord.name} and ${terms.tenant.name}`,
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk: Buffer) => chunks.push(chunk));
  const finished = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.font("Helvetica-Bold").fontSize(16).text("RESIDENTIAL RENTAL AGREEMENT", { align: "center" });
  doc.moveDown(0.3);
  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor("#52525b")
    .text(`Generated by RentVault on ${formatDate(terms.generatedOn)}`, { align: "center" });
  doc.fillColor("#18181b");
  doc.moveDown(1.2);

  doc
    .font("Helvetica")
    .fontSize(BODY_SIZE)
    .text(
      `This Agreement is made on ${formatDate(terms.lease.startDate)} between ${terms.landlord.name} (the "Landlord"), ` +
        `and ${terms.tenant.name} (the "Tenant"). The Landlord and the Tenant are together referred to as the "Parties".`,
      { align: "justify" },
    );
  doc.moveDown(1);

  // Party block — two columns, so the reader can check who is who without
  // parsing a paragraph.
  const columnWidth = (doc.page.width - MARGIN * 2 - 24) / 2;
  const partyTop = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).text("LANDLORD", MARGIN, partyTop, { width: columnWidth });
  doc.font("Helvetica").fontSize(BODY_SIZE);
  doc.text(terms.landlord.name, { width: columnWidth });
  if (terms.landlord.email) doc.text(terms.landlord.email, { width: columnWidth });
  if (terms.landlord.countryOfResidence) doc.text(`Resident of ${terms.landlord.countryOfResidence}`, { width: columnWidth });
  const landlordBottom = doc.y;

  doc.font("Helvetica-Bold").fontSize(9).text("TENANT", MARGIN + columnWidth + 24, partyTop, { width: columnWidth });
  doc.font("Helvetica").fontSize(BODY_SIZE);
  doc.text(terms.tenant.name, { width: columnWidth });
  if (terms.tenant.email) doc.text(terms.tenant.email, { width: columnWidth });
  if (terms.tenant.phone) doc.text(terms.tenant.phone, { width: columnWidth });

  doc.x = MARGIN;
  doc.y = Math.max(landlordBottom, doc.y) + 16;

  for (const clause of clauses(terms)) {
    // Keep a heading with at least the first lines of its body rather than
    // stranding it at the foot of a page.
    if (doc.y > doc.page.height - MARGIN - 90) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(BODY_SIZE).text(clause.heading);
    doc.moveDown(0.25);
    doc.font("Helvetica").fontSize(BODY_SIZE).text(clause.body, { align: "justify" });
    doc.moveDown(0.8);
  }

  if (doc.y > doc.page.height - MARGIN - 160) doc.addPage();
  doc.moveDown(1);
  doc.font("Helvetica-Bold").fontSize(BODY_SIZE).text("IN WITNESS WHEREOF");
  doc.moveDown(0.25);
  doc
    .font("Helvetica")
    .fontSize(BODY_SIZE)
    .text(
      "the Parties have signed this Agreement electronically on the dates recorded in their respective signing certificates.",
      { align: "justify" },
    );
  doc.moveDown(1.5);

  // The provider stamps its signature blocks over the page; these labels tell
  // a human reading the unsigned copy where they will land.
  const signatureTop = doc.y;
  doc.font("Helvetica-Bold").fontSize(9).text("LANDLORD (signs first)", MARGIN, signatureTop, { width: columnWidth });
  doc.font("Helvetica").fontSize(9).fillColor("#71717a").text(terms.landlord.name, { width: columnWidth });
  doc.fillColor("#18181b");
  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("TENANT (signs after the Landlord)", MARGIN + columnWidth + 24, signatureTop, { width: columnWidth });
  doc.font("Helvetica").fontSize(9).fillColor("#71717a").text(terms.tenant.name, { width: columnWidth });

  doc.x = MARGIN;
  doc.moveDown(3);
  doc
    .font("Helvetica")
    .fontSize(8)
    .fillColor("#71717a")
    .text(
      "Note: this instrument has not been stamped. Stamp duty is payable under the Indian Stamp Act as adopted by the " +
        "State in which the Premises are situated, and an unstamped agreement is admissible in evidence only on payment " +
        "of the duty and any penalty. The Parties should e-stamp or frank this Agreement, and register it where the term " +
        "requires registration under Section 17 of the Registration Act, 1908.",
      MARGIN,
      doc.y,
      { align: "justify" },
    );

  doc.end();
  const buffer = await finished;
  return { buffer, sha256: createHash("sha256").update(buffer).digest("hex") };
}
