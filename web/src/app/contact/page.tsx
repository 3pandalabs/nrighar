import type { Metadata } from "next";
import Link from "next/link";
import { GradientBackdrop } from "@/components/GradientBackdrop";
import { WordmarkName, WordmarkTag } from "@/components/Wordmark";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: "Contact us — RentVault",
  description: "Get in touch with the RentVault team.",
};

// ⚠️ PLACEHOLDER — replace before this page goes live.
// A support phone line was asked for but no number was given, and inventing a
// plausible-looking one is worse than an obvious blank: it would ship a page
// telling NRI landlords to call a number that isn't ours.
const SUPPORT_PHONE_DISPLAY = "+91 00000 00000";
const SUPPORT_PHONE_E164 = "+910000000000";

// The org address. Swap for a dedicated support@ mailbox when one exists —
// this one also owns the infrastructure accounts, so publishing it invites
// spam at the address you least want it.
const SUPPORT_EMAIL = "3pandalabs@gmail.com";

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

const PhoneIcon = () => (
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
    <path d="M6.5 3h3l1.5 4.5-2 1.5a12 12 0 0 0 6 6l1.5-2 4.5 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3Z" />
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
          Speak to us now
        </h1>
        <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600 dark:text-zinc-400">
          Managing a property from another country is hard enough. Whether you&apos;re an owner listing a home or a
          tenant applying for one, there&apos;s a person on the other end of all three of these.
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
                The best way to reach us for anything that isn&apos;t urgent — questions about a listing, a payment, or
                your account. We reply within one business day.
              </span>
              <span className="mt-2 block text-sm font-medium text-zinc-900 dark:text-zinc-50">{SUPPORT_EMAIL}</span>
            </span>
            <span className="text-zinc-400 dark:text-zinc-500">
              <ArrowIcon />
            </span>
          </a>

          <a
            href={`tel:${SUPPORT_PHONE_E164}`}
            className="group flex items-start gap-5 rounded-2xl border border-zinc-200 bg-white p-6 transition-colors hover:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-600"
          >
            <span className="text-zinc-900 dark:text-zinc-50">
              <PhoneIcon />
            </span>
            <span className="flex-1">
              <span className="block text-lg font-semibold text-zinc-900 dark:text-zinc-50">Call us</span>
              <span className="mt-1 block text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
                For anything time-sensitive — a tenant moving in, a payment that hasn&apos;t landed, a document you need
                today.
              </span>
              <span className="mt-2 block text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {SUPPORT_PHONE_DISPLAY}
              </span>
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
