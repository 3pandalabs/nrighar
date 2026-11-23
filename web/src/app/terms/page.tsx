import type { Metadata } from "next";
import { A, LegalPage, Mail, Section, UL } from "@/components/legal";

export const metadata: Metadata = {
  title: "Terms of Use",
  description:
    "The terms for using RentVault, a platform for owners and tenants to manage a rental home in India. RentVault is not a party to your lease, a broker or a payment service.",
  alternates: { canonical: "/terms" },
};

const TOC = [
  { id: "service", title: "The service" },
  { id: "platform", title: "We're a platform, not a party to your lease" },
  { id: "payments", title: "Rent and payments" },
  { id: "verification", title: "Identity documents" },
  { id: "advice", title: "Not legal or tax advice" },
  { id: "account", title: "Your account" },
  { id: "content", title: "What you upload" },
  { id: "use", title: "Acceptable use" },
  { id: "price", title: "Price" },
  { id: "liability", title: "Disclaimers and liability" },
  { id: "ending", title: "Ending the service" },
  { id: "law", title: "Governing law" },
  { id: "contact", title: "Contact" },
];

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      toc={TOC}
      intro={
        <p>
          These terms are an agreement between you and 3PandaLabs LLC, a New Jersey limited liability company (&ldquo;3PandaLabs&rdquo;,
          &ldquo;we&rdquo;), for using RentVault. By creating an account, or by submitting details through a RentVault invite or payment
          link, you agree to them and to our <A href="/privacy">Privacy Policy</A>.
        </p>
      }
    >
      <Section id="service" title="1. The service">
        <p>
          RentVault is software that helps property owners keep track of a rental home in India (properties, tenants, leases, monthly rent and
          documents), open listings and compare applications, and helps tenants browse open listings, apply, message an owner and keep their
          own profile and documents in one place. It can also build a UPI payment link from the owner&apos;s UPI details and automatically read
          identity documents to help an owner review them.
        </p>
      </Section>

      <Section id="platform" title="2. We're a platform, not a party to your lease">
        <UL>
          <li>
            Any rental agreement is made directly between the owner and the tenant. 3PandaLabs is not a party to it, isn&apos;t a landlord,
            tenant, agent or property manager, and has no duties under it.
          </li>
          <li>
            We aren&apos;t a real estate broker or agent, don&apos;t negotiate on anyone&apos;s behalf, and don&apos;t charge brokerage. We
            don&apos;t inspect, own or guarantee any property, and we don&apos;t guarantee that any owner, tenant, listing or application is
            genuine, accurate or suitable.
          </li>
          <li>
            Owners and tenants are each responsible for their own decisions, including choosing a tenant or home, checking each other&apos;s
            identity and the property&apos;s title, registering the agreement and paying any stamp duty, and following the rental, tax and
            foreign-exchange laws that apply to them in India and in the country where they live.
          </li>
          <li>
            Owners must make decisions about applicants fairly and lawfully, and must not discriminate on grounds the law forbids.
          </li>
        </UL>
      </Section>

      <Section id="payments" title="3. Rent and payments">
        <p>
          RentVault doesn&apos;t collect, hold or transfer money. It isn&apos;t a bank, payment service, payment aggregator or escrow agent.
          Rent and deposits are paid directly between tenant and owner, outside RentVault, for example by UPI to the owner&apos;s own UPI ID
          or by bank transfer. A payment link only opens the tenant&apos;s own UPI app with the owner&apos;s details filled in. When a tenant
          marks rent as paid, or an owner records a payment, that is a note in RentVault, not proof that money moved. Check your bank or UPI
          app for that. Disputes about rent, deposits or refunds are between owner and tenant.
        </p>
      </Section>

      <Section id="verification" title="4. Identity documents">
        <p>
          Automatic reading of identity documents is an aid for the owner, not an official verification. RentVault doesn&apos;t currently
          check documents against government records, and its results can be wrong. Upload only your own documents, or documents you&apos;re
          authorised to share, and only for renting a home.
        </p>
      </Section>

      <Section id="advice" title="5. Not legal or tax advice">
        <p>
          RentVault gives general tools and information. It isn&apos;t legal, tax, financial or property advice. Talk to a qualified
          professional about rental agreements, tenant verification with local police, tax on rental income, or repatriating rent from India.
        </p>
      </Section>

      <Section id="account" title="6. Your account">
        <UL>
          <li>You must be 18 or older and give accurate account details.</li>
          <li>Keep your password secret. You&apos;re responsible for activity in your account.</li>
          <li>
            Owners should add only properties they own or are authorised to manage, and only tenants who have agreed to their details being
            stored.
          </li>
          <li>Keep invite, payment and profile share links private. Anyone with the link can use it until it expires or you revoke it.</li>
        </UL>
      </Section>

      <Section id="content" title="7. What you upload">
        <p>
          You keep ownership of your documents, photos and data. You give us permission to store, process and display them only to provide
          RentVault to you and to the people you share them with, including sending them to the processors listed in the Privacy Policy.
          You&apos;re responsible for having the right to upload them, and listings and photos must be accurate and not misleading.
        </p>
      </Section>

      <Section id="use" title="8. Acceptable use">
        <UL>
          <li>Don&apos;t upload other people&apos;s documents without their permission, or anything false, forged or unlawful.</li>
          <li>Don&apos;t post fake listings, ask for money outside an agreed rental, or use messages to harass anyone.</li>
          <li>Don&apos;t upload malware, try to break or overload the service, or reach data that isn&apos;t yours.</li>
          <li>Don&apos;t resell or scrape the service.</li>
        </UL>
      </Section>

      <Section id="price" title="9. Price">
        <p>
          RentVault is free while in early access. If we introduce paid plans, we&apos;ll tell you in advance, and you won&apos;t be charged
          without agreeing.
        </p>
      </Section>

      <Section id="liability" title="10. Disclaimers and liability">
        <p>
          RentVault is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without warranties of any kind, to the fullest extent the law
          allows. To the fullest extent the law allows, 3PandaLabs isn&apos;t liable for indirect, incidental or consequential losses; for
          anything an owner or tenant does or fails to do, including unpaid rent, unreturned deposits, property damage or disputes; or for
          decisions you make based on RentVault. Our total liability for any claim is limited to US$100. Nothing in these terms limits
          liability that can&apos;t be limited by law.
        </p>
      </Section>

      <Section id="ending" title="11. Ending the service">
        <p>
          You can stop using RentVault and ask us to delete your account at any time by emailing <Mail />. We may suspend or close accounts
          that break these terms, and remove listings or content that do. If we shut RentVault down, we&apos;ll give at least 30 days&apos;
          notice so you can download your documents and records.
        </p>
      </Section>

      <Section id="law" title="12. Governing law">
        <p>
          These terms are governed by the laws of the State of New Jersey, USA, without regard to conflict-of-law rules. Courts located in New
          Jersey have jurisdiction, except where the law of the country you live in gives you the right to bring a claim locally. We may update
          these terms; if a change matters, we&apos;ll email you first.
        </p>
      </Section>

      <Section id="contact" title="13. Contact">
        <p>
          Questions: <Mail />, +1 (332) 316-8453, or our <A href="/contact">contact page</A>.
        </p>
      </Section>
    </LegalPage>
  );
}
