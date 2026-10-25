import type { Metadata } from "next";
import Link from "next/link";
import { GradientBackdrop } from "@/components/GradientBackdrop";
import { WordmarkName, WordmarkTag } from "@/components/Wordmark";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact us — RentVault",
  description: "Get in touch with the RentVault team.",
};

// The dedicated support mailbox this file has been asking for. It is a
// Cloudflare Email Routing alias forwarding to the org inbox — free, and
// revocable without touching the destination if it ever attracts spam.
//
// Deliberately NOT 3pandas@3pandalabs.com, which is now the address business
// correspondence is SENT from (vendor onboarding, KYB). Publishing a sending
// identity on a page crawlers read is how it lands on scrape lists, and a
// spam-scored sending address is precisely what you cannot afford when the
// counterparty runs the mail filter. Same reasoning that retired the gmail
// address here — it just applies to a different address now.
const SUPPORT_EMAIL = "support@3pandalabs.com";

const ArrowIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="size-6 shrink-0 transition-transform group-hover:translate-x-1"
  >
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

const MailIcon = () => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="size-8"
  >
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

export default function ContactPage() {
  return (
    <div className="relative">
      <GradientBackdrop />

      <header className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-8">
        <span className="inline-flex items-center">
          <Link href="/" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            <WordmarkName />
          </Link>
          <WordmarkTag />
        </span>
        <Link
          href="/login"
          className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pb-24">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
          Get in touch
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          Managing a property from another country is hard enough. Whether you&apos;re an owner listing a home or a
          tenant applying for one, there&apos;s a person on the other end of both of these.
        </p>

        <div className="mt-10 flex flex-col gap-4">
          {/* Card layout follows the reference screenshot — icon, title,
              description, arrow — in RentVault's own zinc palette rather than
              the source's branding. */}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="group flex items-start gap-5 rounded-2xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            <span className="text-zinc-900 dark:text-zinc-50">
              <MailIcon />
            </span>
            <span className="flex-1">
              <span className="block text-lg font-semibold text-zinc-900 dark:text-zinc-50">Email us</span>
              <span className="mt-1 block text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                The best way to reach us — questions about a listing, a payment, or your
                account. We reply within one business day.
              </span>
              <span className="mt-2 block text-sm font-medium text-zinc-900 dark:text-zinc-50">{SUPPORT_EMAIL}</span>
            </span>
            <span className="text-zinc-400 dark:text-zinc-500">
              <ArrowIcon />
            </span>
          </a>
        </div>

        <div className="mt-4">
          <ContactForm />
        </div>
      </main>
    </div>
  );
}
