import type { Metadata } from "next";
import { A, H3, LegalPage, Mail, Section, UL } from "@/components/legal";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What RentVault collects about owners, tenants, properties, leases, rent and identity documents, who processes it, and how to access or delete it.",
  alternates: { canonical: "/privacy" },
};

const TOC = [
  { id: "summary", title: "The short version" },
  { id: "collect", title: "What we collect" },
  { id: "not-collect", title: "What we never collect" },
  { id: "use", title: "How we use it" },
  { id: "sharing", title: "Who can see it inside RentVault" },
  { id: "processors", title: "Who processes it for us" },
  { id: "transfers", title: "Where it is stored" },
  { id: "security", title: "How it's protected" },
  { id: "cookies", title: "Cookies" },
  { id: "retention", title: "How long we keep it" },
  { id: "rights", title: "Your rights, including under India's DPDP Act" },
  { id: "children", title: "Children" },
  { id: "changes", title: "Changes" },
  { id: "contact", title: "Contact and grievances" },
];

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      toc={TOC}
      intro={
        <p>
          RentVault is a service of 3PandaLabs LLC, a New Jersey limited liability company (&ldquo;3PandaLabs&rdquo;, &ldquo;we&rdquo;,
          &ldquo;us&rdquo;). It helps property owners, many of them living outside India, manage a rental home in India, and helps tenants
          find a home, apply for it and keep their rental documents in one place. Because that involves addresses, rent and identity
          documents, this policy is specific about exactly what we hold and who can see it.
        </p>
      }
    >
      <Section id="summary" title="1. The short version">
        <UL>
          <li>We hold what owners and tenants type in or upload: property details, tenant contacts, leases, rent records and documents.</li>
          <li>We never handle your money. Rent is paid directly from tenant to owner (for example by UPI); we only record it.</li>
          <li>Documents are stored in a private bucket and are only ever shown through short-lived links to people allowed to see them.</li>
          <li>Aadhaar numbers read from identity documents are masked to their last 4 digits before we store the extracted details.</li>
          <li>We don&apos;t sell your data, show ads or use analytics or tracking cookies.</li>
        </UL>
      </Section>

      <Section id="collect" title="2. What we collect">
        <H3>Account details</H3>
        <p>
          Your email address and a hashed password (we can&apos;t read it), whether you use RentVault as an owner or a tenant, and optional
          profile details: display name, country of residence and preferred currency.
        </p>
        <H3>Owners: properties, listings and photos</H3>
        <p>
          Property nickname, address (street, city, state, PIN code), property type, bedrooms and notes; listings you open (asking rent and
          minimum lease length); and property photos with captions.
        </p>
        <H3>Owners: tenants, leases and rent</H3>
        <p>
          The tenants you add (name, phone, email, verification status and notes), leases (property, tenant, rent, deposit, start and end
          dates, rent due day) and the rent record for each month (amount due, amount paid, date, method and notes). If you collect rent by
          UPI, we store the UPI ID and payee name you enter so we can build a payment link for your tenant.
        </p>
        <H3>Tenants: profile and applications</H3>
        <p>
          Your name, phone, email, current city and employer; applications you make on a listing (proposed rent, move-in date, and optionally
          your monthly income and a short note about yourself); and messages you exchange with the owner about an application. We
          deliberately don&apos;t ask for religion, caste, marital status or similar personal characteristics, and we don&apos;t run credit
          checks.
        </p>
        <H3>Documents</H3>
        <p>
          Files you upload, such as rental agreements, property papers, tax documents and identity documents. A tenant may also send name,
          phone, email and documents to an owner through an invite link the owner shares, without creating an account.
        </p>
        <H3>Identity documents and verification</H3>
        <p>
          When an identity document (PAN card, Aadhaar card or Indian passport) is uploaded as a KYC document, we automatically read it to
          extract the name, document number, date of birth and similar printed fields, and to flag obvious quality problems (blur, glare,
          missing fields, signs of tampering). Aadhaar numbers are masked to their last 4 digits before the extracted details are saved. The
          result is a suggestion for the owner to review, not an official check: RentVault does not currently verify documents against
          government records, and an owner or tenant may still be asked for further identity details by the other party.
        </p>
        <H3>Rent payment links</H3>
        <p>
          When a tenant opens a payment link, we record when it was opened and when the tenant marked the rent as paid. We don&apos;t see or
          receive the payment itself.
        </p>
        <H3>Contact form</H3>
        <p>Your name, email and message, delivered to our support inbox by email.</p>
        <H3>Technical data</H3>
        <p>
          Standard server logs (IP address, browser type, timestamps, request paths and response codes) used for security, abuse prevention
          and debugging, and sign-in session records.
        </p>
      </Section>

      <Section id="not-collect" title="3. What we never collect">
        <UL>
          <li>Bank, card or UPI login credentials, PINs or OTPs. We can&apos;t move money.</li>
          <li>Full Aadhaar numbers in the details we extract and store (only the last 4 digits). The original file you uploaded is kept as uploaded, privately, until it is deleted.</li>
          <li>Credit scores or credit bureau reports.</li>
          <li>Your contacts, location or advertising identifiers. We don&apos;t use analytics or advertising trackers.</li>
        </UL>
      </Section>

      <Section id="use" title="4. How we use it">
        <UL>
          <li>To run RentVault: show owners their properties, tenants, leases, rent and documents, and show tenants their profile, applications and documents.</li>
          <li>To show open listings, and their photos, to signed-in tenants browsing for a home, and to let owners compare and respond to applications.</li>
          <li>To read identity documents and suggest whether they look complete and valid, as described above.</li>
          <li>To send you emails you need, such as password resets, and to answer messages you send us.</li>
          <li>To keep the service secure, prevent abuse and fix problems.</li>
        </UL>
        <p>We don&apos;t sell or rent your data, and we don&apos;t use it for advertising or to build profiles for anyone else.</p>
      </Section>

      <Section id="sharing" title="5. Who can see it inside RentVault">
        <UL>
          <li>
            <strong>Owners</strong> see what they enter, plus what a tenant chooses to share with them: an application, an intake submission
            sent through their invite link, or a tenant profile and documents shared through a profile link.
          </li>
          <li>
            <strong>Tenants</strong> see their own profile and documents, the listings that are open, and the messages on their own
            applications.
          </li>
          <li>
            <strong>Listings:</strong> while a listing is open, its property details, asking rent and photos are visible to signed-in tenants.
            Closing the listing stops this.
          </li>
          <li>A tenant can revoke a profile share link; we don&apos;t show your data to any other user.</li>
        </UL>
      </Section>

      <Section id="processors" title="6. Who processes it for us">
        <p>We use a small number of service providers, each only for the job listed:</p>
        <UL>
          <li>
            <strong>Hetzner Online GmbH</strong> (Germany): hosts our servers and database, where your account, property, lease and rent
            records are stored, and runs our background processing.
          </li>
          <li>
            <strong>Cloudflare, Inc.</strong> (USA): serves the website and stores uploaded documents, property photos and encrypted database
            backups in its R2 storage.
          </li>
          <li>
            <strong>Anthropic, PBC</strong> (USA): identity documents uploaded as KYC documents are sent to Anthropic&apos;s API to extract
            their printed details. Anthropic processes this data under commercial terms that don&apos;t allow it to train models on our API
            data.
          </li>
          <li>
            <strong>Resend, Inc.</strong> (USA): delivers our emails (password resets and contact-form messages).
          </li>
        </UL>
        <p>We may also disclose data if the law requires it, or to protect the rights and safety of our users or of 3PandaLabs.</p>
      </Section>

      <Section id="transfers" title="7. Where it is stored">
        <p>
          3PandaLabs is based in the United States, and our providers store and process data in Germany, the United States and other
          countries where they operate. If you are in India or elsewhere, your data will be transferred outside your country, including to the
          United States. We transfer data only to countries not restricted by the Government of India under the DPDP Act, and we require our
          providers to protect it.
        </p>
      </Section>

      <Section id="security" title="8. How it's protected">
        <UL>
          <li>All traffic uses HTTPS.</li>
          <li>
            Documents and photos are stored in a private bucket. Nothing is publicly readable; files are only shown through links that expire
            within minutes, issued to someone allowed to see them.
          </li>
          <li>Passwords and sign-in tokens are stored only as one-way hashes.</li>
          <li>Every request is checked against your account. Nobody else&apos;s account can reach your data unless you share it.</li>
          <li>Access to production systems is limited to the 3PandaLabs team and protected by multi-factor access controls.</li>
        </UL>
        <p>No system is perfectly secure. If a breach affects your data, we&apos;ll notify you and the authorities as the law requires.</p>
      </Section>

      <Section id="cookies" title="9. Cookies">
        <p>
          We use only the cookies needed to keep you signed in. They can&apos;t be read by scripts on the page, and we don&apos;t use
          analytics, advertising or third-party tracking cookies. The mobile app keeps its sign-in tokens in your phone&apos;s secure storage.
        </p>
      </Section>

      <Section id="retention" title="10. How long we keep it">
        <UL>
          <li>
            <strong>Properties, tenants, leases, rent records and documents:</strong> kept while your account is open, so you have a history
            of your tenancy. You can delete documents and records at any time.
          </li>
          <li>
            <strong>Tenant invite links</strong> expire after 14 days. Expired sign-in sessions are purged automatically.
          </li>
          <li>
            <strong>Everything:</strong> deleted within 30 days of your request to delete your account, except encrypted backups, which roll
            off within a further 30 days, and anything we must keep by law.
          </li>
          <li>Server logs are kept for up to 30 days.</li>
        </UL>
      </Section>

      <Section id="rights" title="11. Your rights, including under India's DPDP Act">
        <p>
          If you are in India, the Digital Personal Data Protection Act, 2023 gives you the right to access a summary of your personal data,
          to correct and complete it, to have it erased, to nominate someone to exercise your rights if you die or become incapacitated, and to
          grievance redressal. You can withdraw consent at any time by asking us to delete your account; this doesn&apos;t affect processing
          that happened before.
        </p>
        <p>Wherever you live, you can:</p>
        <UL>
          <li>
            <strong>See and correct</strong> your profile, properties, tenants, leases, rent records and documents in the app.
          </li>
          <li>
            <strong>Delete</strong> individual documents and records in the app, or your whole account by emailing <Mail /> from the address
            you signed up with.
          </li>
          <li>
            <strong>Stop sharing</strong> by revoking a profile share link or closing a listing.
          </li>
          <li>
            <strong>Get a copy</strong> of your data by emailing us.
          </li>
        </UL>
        <p>
          If an owner added you as a tenant and you don&apos;t have an account, you can still email us to see, correct or delete what we hold
          about you. We answer within 30 days. If you&apos;re not satisfied, you can complain to the Data Protection Board of India or your
          local data protection authority.
        </p>
      </Section>

      <Section id="children" title="12. Children">
        <p>
          RentVault is for people 18 and older. We don&apos;t knowingly collect data from children; if you believe a child has signed up, email
          us and we&apos;ll delete the account.
        </p>
      </Section>

      <Section id="changes" title="13. Changes">
        <p>
          If we change this policy in a way that matters, we&apos;ll email you before it takes effect. The date at the top shows the latest
          version.
        </p>
      </Section>

      <Section id="contact" title="14. Contact and grievances">
        <p>
          3PandaLabs LLC, New Jersey, USA. Email <Mail /> for privacy questions, data requests and grievances (our Grievance Officer reads this
          mailbox), or call +1 (332) 316-8453. You can also use our <A href="/contact">contact page</A>. This policy is governed by the laws
          of the State of New Jersey, USA, without affecting any rights you have under the laws of the country where you live.
        </p>
      </Section>
    </LegalPage>
  );
}
