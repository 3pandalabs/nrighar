import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { Fraunces } from "next/font/google";
import { GradientBackdrop } from "@/components/GradientBackdrop";
import { Wordmark } from "@/components/Wordmark";
import "./home.css";

// Display face for headings on the home page only; the rest of the app keeps
// Geist. next/font self-hosts it, so no request goes to Google at runtime.
const display = Fraunces({
  variable: "--font-rt-display",
  subsets: ["latin"],
  weight: ["500", "600"],
  style: ["normal", "italic"],
});

const MARQUEE = [
  "Rent in INR + your home currency",
  "One-tap WhatsApp reminders",
  "UPI pay links",
  "Rent agreements",
  "Tenant KYC",
  "Property papers",
  "Deposits & due dates",
  "Portable tenant profiles",
  "Open from any timezone",
];

// Example ledger rows for the hero illustration. Clearly labelled "Example"
// on the card; the names, flats and amounts are made up.
const LEDGER = [
  { flat: "Flat 2B, Pune", tenant: "Ravi", inr: "₹28,000", cur: ["$334", "£265", "AED 1,227"], row: "0s" },
  { flat: "Villa 7, Kochi", tenant: "Meera", inr: "₹42,000", cur: ["$500", "£396", "AED 1,841"], row: "1.5s" },
  { flat: "Unit 404, Gurugram", tenant: "Arjun", inr: "₹18,500", cur: ["$220", "£175", "AED 811"], row: "4.5s" },
];

const STATES = [
  { label: "Sent", cls: "bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300" },
  { label: "Opened", cls: "bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300" },
  { label: "Paid", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300" },
];

const slot = (n: number, extra?: Record<string, string>) =>
  ({ "--slot": n, ...extra }) as CSSProperties;

export default function Home() {
  return (
    <div className={`${display.variable} flex min-h-screen flex-col overflow-x-clip font-sans`}>
      <GradientBackdrop />
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-4 py-5 sm:px-6 sm:py-6">
        <span className="min-w-0 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          <Wordmark />
        </span>
        <span className="flex shrink-0 items-center gap-3 whitespace-nowrap sm:gap-5">
          <Link
            href="/contact"
            className="text-sm font-medium text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
          >
            Contact us
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm sm:px-5 font-medium text-zinc-900 transition-colors hover:bg-zinc-900 hover:text-white dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-white dark:hover:text-zinc-900"
          >
            Sign in
          </Link>
        </span>
      </header>

      <main className="flex-1">
        {/* ---------- Hero ---------- */}
        <section className="mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-14 px-6 pt-10 pb-20 lg:grid-cols-[1.05fr_1fr] lg:pt-16 lg:pb-28">
          <div className="text-center lg:text-left">
            <p className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3.5 py-1.5 text-xs font-semibold tracking-wide text-emerald-800 uppercase backdrop-blur dark:border-emerald-500/30 dark:bg-white/5 dark:text-emerald-300">
              <span className="rt-ping inline-block size-2 rounded-full bg-emerald-500" />
              For NRI landlords &amp; their tenants
            </p>
            <h1 className="rt-display mt-6 text-[2.6rem] leading-[1.05] text-zinc-900 sm:text-6xl dark:text-zinc-50">
              Your property in India.{" "}
              <span className="rt-shimmer italic">Managed from anywhere.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg leading-8 text-zinc-600 lg:mx-0 dark:text-zinc-400">
              RentVault keeps NRI landlords on top of their rentals back home — tenants, monthly rent in
              INR and your home currency, and every agreement and document in one safe place.
            </p>
            <div className="mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
              <Link
                href="/login"
                className="rt-btn-shine inline-flex items-center gap-2 rounded-full bg-zinc-900 px-8 py-3.5 text-base font-medium text-white shadow-lg shadow-emerald-900/10 transition-transform hover:-translate-y-0.5 dark:bg-white dark:text-zinc-900"
              >
                Get started <Arrow />
              </Link>
              <a
                href="#how"
                className="text-sm font-medium text-zinc-600 underline-offset-4 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-50"
              >
                See how it works
              </a>
            </div>
          </div>

          <HeroLedger />
        </section>

        {/* ---------- Marquee ---------- */}
        <section
          aria-label="What RentVault covers"
          className="border-y border-zinc-200/70 bg-white/50 py-5 backdrop-blur dark:border-zinc-800 dark:bg-white/[0.03]"
        >
          <div className="rt-marquee overflow-hidden">
            <div className="rt-marquee-track">
              {[0, 1].map((copy) => (
                <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center gap-10 pr-10">
                  {MARQUEE.map((m) => (
                    <li
                      key={m}
                      className="rt-display flex items-center gap-10 text-2xl whitespace-nowrap text-zinc-800 italic sm:text-3xl dark:text-zinc-200"
                    >
                      {m}
                      <span aria-hidden className="text-base text-[#b98d4f] not-italic">
                        ✦
                      </span>
                    </li>
                  ))}
                </ul>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- How it works ---------- */}
        <section id="how" className="mx-auto w-full max-w-6xl scroll-mt-10 px-6 py-24">
          <SectionHead kicker="How it works" title="Three steps, from" accent="any timezone." />
          <ol className="relative mt-14 grid gap-10 md:grid-cols-3 md:gap-8">
            <div aria-hidden className="rt-dash absolute top-6 right-[16%] left-[16%] hidden h-0.5 md:block" />
            {[
              ["Track", "Add your properties, tenants, and lease terms — rent amount, deposit, due date."],
              [
                "Collect",
                "See who's paid and who hasn't each month, in INR and your home currency, with one-tap WhatsApp reminders.",
              ],
              [
                "Store",
                "Rent agreements, tenant KYC, and property papers in a private vault you can open from any timezone.",
              ],
            ].map(([title, body], i) => (
              <li key={title} className="relative flex flex-col items-center text-center">
                <span className="relative flex size-12 items-center justify-center rounded-full bg-emerald-600 text-base font-semibold text-white shadow-lg ring-8 shadow-emerald-600/25 ring-zinc-50 dark:ring-black">
                  {i + 1}
                </span>
                <h3 className="rt-display mt-5 text-2xl text-zinc-900 dark:text-zinc-50">{title}</h3>
                <p className="mt-2 max-w-xs text-sm leading-6 text-zinc-600 dark:text-zinc-400">{body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* ---------- Features ---------- */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <SectionHead kicker="Rent day, remotely" title="Everything back home," accent="in one place." />
          <div className="mt-14 grid gap-6 md:grid-cols-3">
            <Tile
              title="Rent in two currencies"
              body="Every month's rent in INR, with the amount in your home currency right beside it."
            >
              <div className="space-y-2">
                {[
                  ["Nov", "₹28,000", "$334", "w-full"],
                  ["Oct", "₹28,000", "$336", "w-full"],
                  ["Sep", "₹26,500", "$318", "w-[94%]"],
                ].map(([m, inr, usd, w]) => (
                  <div key={m} className="flex items-center gap-3 text-xs">
                    <span className="w-7 font-medium text-zinc-500 dark:text-zinc-400">{m}</span>
                    <span className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800">
                      <span className={`rt-bar block h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 ${w}`} />
                    </span>
                    <span className="w-16 text-right font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">{inr}</span>
                    <span className="w-10 text-right text-zinc-500 tabular-nums dark:text-zinc-400">{usd}</span>
                  </div>
                ))}
                <p className="pt-1 text-[10px] tracking-wider text-zinc-400 uppercase">Example amounts</p>
              </div>
            </Tile>

            <Tile
              title="Reminders tenants can pay from"
              body="A one-tap WhatsApp reminder carries a UPI pay link. Payment goes directly to you via UPI — RentVault never handles the money."
            >
              <div className="space-y-2 text-xs">
                <div className="ml-auto w-[88%] rounded-2xl rounded-tr-sm bg-[#d9fdd3] px-3 py-2 text-zinc-800 shadow-sm dark:bg-emerald-900/60 dark:text-emerald-50">
                  Rent for November is due on the 5th. Pay by UPI here 👇
                  <span className="mt-1 block truncate font-medium text-emerald-700 underline dark:text-emerald-300">
                    nrighar.3pandalabs.com/pay/…
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {STATES.map((s) => (
                    <span key={s.label} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}>
                      {s.label}
                    </span>
                  ))}
                </div>
              </div>
            </Tile>

            <Tile
              title="A private document vault"
              body="Agreements, KYC and property papers are never public — they open only through short-lived links for the people you allow."
            >
              <div className="relative flex h-28 flex-col items-center gap-1.5 pb-6">
                {["Rent agreement.pdf", "Tenant KYC.pdf", "Property papers.pdf"].map((d, i) => (
                  <span
                    key={d}
                    className="rt-doc rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-[10px] font-medium whitespace-nowrap text-zinc-700 shadow-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200"
                    style={{ "--t": `${i * 0.4}s` } as CSSProperties}
                  >
                    📄 {d}
                  </span>
                ))}
                <span className="absolute -bottom-1 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1 text-[10px] font-semibold text-white dark:bg-white dark:text-zinc-900">
                  <Lock /> Private
                </span>
              </div>
            </Tile>
          </div>
        </section>

        {/* ---------- Two-sided: tenants ---------- */}
        <section className="mx-auto w-full max-w-6xl px-6 pb-24">
          <div className="grid items-center gap-10 overflow-hidden rounded-[2rem] border border-zinc-200 bg-white/70 p-8 backdrop-blur sm:p-12 md:grid-cols-2 dark:border-zinc-800 dark:bg-white/[0.03]">
            <div>
              <p className="text-xs font-semibold tracking-widest text-[#b98d4f] uppercase">For tenants too</p>
              <h2 className="rt-display mt-3 text-4xl leading-tight text-zinc-900 dark:text-zinc-50">
                One profile you <span className="rt-shimmer italic">carry with you.</span>
              </h2>
              <p className="mt-4 text-base leading-7 text-zinc-600 dark:text-zinc-400">
                Tenants get their own RentVault space: a profile and their own documents, shared with a
                landlord through a link — and revoked whenever they choose. They can also browse open
                listings.
              </p>
              <Link
                href="/login"
                className="mt-7 inline-flex items-center gap-2 rounded-full border border-zinc-300 px-6 py-2.5 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-900 hover:text-white dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-white dark:hover:text-zinc-900"
              >
                I&apos;m a tenant <Arrow />
              </Link>
            </div>
            <div aria-hidden className="mx-auto w-full max-w-sm">
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-[#b98d4f] text-sm font-semibold text-white">
                    PS
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Tenant profile</p>
                    <p className="text-xs text-zinc-500">3 documents · example</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-zinc-50 px-3 py-2.5 text-xs dark:bg-zinc-800/70">
                  <span className="truncate text-zinc-600 dark:text-zinc-300">Share link for landlord</span>
                  <span className="relative inline-grid">
                    <span
                      className="rt-share col-start-1 row-start-1 rounded-full bg-emerald-100 px-2.5 py-1 font-semibold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300"
                      data-first
                    >
                      Shared
                    </span>
                    <span
                      className="rt-share col-start-1 row-start-1 rounded-full bg-zinc-200 px-2.5 py-1 font-semibold text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200"
                      style={{ "--t": "-4s" } as CSSProperties}
                    >
                      Revoked
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------- Final CTA ---------- */}
        <section className="px-6 pb-24">
          <div className="rt-glow relative mx-auto w-full max-w-6xl overflow-hidden rounded-[2.5rem] px-6 py-20 text-center text-white shadow-2xl sm:px-8">
            <h2 className="rt-display relative text-4xl leading-tight sm:text-6xl">
              Your rentals back home, <span className="text-[#e8c48f] italic">sorted.</span>
            </h2>
            <p className="relative mx-auto mt-5 max-w-md text-lg text-emerald-100/80">
              Tenants, rent and documents in one place, built for NRIs.
            </p>
            <Link
              href="/login"
              className="rt-btn-shine relative mt-9 inline-flex items-center gap-2 rounded-full bg-white px-8 py-4 text-base font-semibold text-zinc-900 shadow-xl transition-transform hover:-translate-y-0.5"
            >
              Get started <Arrow />
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}

/** Hero illustration: an example monthly rent ledger whose rows cycle
 * Sent -> Opened -> Paid, with the home-currency column rotating and a
 * WhatsApp-style reminder floating over it. Decorative only. */
function HeroLedger() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md pt-10 pb-16 lg:max-w-lg">
      {/* Route from abroad to home */}
      <svg viewBox="0 0 380 70" className="rt-route absolute inset-x-0 top-0 h-14 w-full overflow-visible text-emerald-500/70">
        <path className="rt-route-line" d="M 20 60 C 120 -10, 260 -10, 360 52" fill="none" stroke="currentColor" strokeWidth="2" />
        <circle cx="20" cy="60" r="4" fill="#b98d4f" />
        <circle cx="360" cy="52" r="4" fill="#059669" />
        <g className="rt-plane">
          <path d="M-7 -3 L7 0 L-7 3 L-4 0 Z" fill="#059669" />
        </g>
      </svg>
      <div className="absolute top-12 left-0 text-[10px] font-semibold tracking-wider text-[#b98d4f] uppercase sm:left-2">
        You, abroad
      </div>
      <div className="absolute top-12 right-0 text-[10px] font-semibold tracking-wider text-emerald-700 uppercase sm:right-2 dark:text-emerald-400">
        Home, India
      </div>

      <div className="rt-float relative mt-10 rounded-3xl border border-zinc-200 bg-white/95 p-5 shadow-2xl shadow-emerald-900/10 backdrop-blur sm:p-6 dark:border-zinc-700 dark:bg-zinc-900/95">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold tracking-wider text-zinc-500 uppercase">Rent ledger</p>
            <p className="rt-display text-2xl text-zinc-900 dark:text-zinc-50">November</p>
          </div>
          <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-semibold tracking-wider text-zinc-500 uppercase dark:bg-zinc-800 dark:text-zinc-400">
            Example
          </span>
        </div>

        <ul className="mt-5 divide-y divide-zinc-100 dark:divide-zinc-800">
          {LEDGER.map((r) => (
            <li key={r.flat} className="flex items-center gap-3 py-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                <House />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">{r.flat}</p>
                <p className="text-xs text-zinc-500">{r.tenant}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold text-zinc-900 tabular-nums dark:text-zinc-50">{r.inr}</p>
                <p className="inline-grid text-xs text-zinc-500 tabular-nums">
                  {r.cur.map((c, i) => (
                    <span key={c} className="rt-cur col-start-1 row-start-1 text-right" style={slot(i)} data-first={i === 0 || undefined}>
                      {c}
                    </span>
                  ))}
                </p>
              </div>
              <span className="inline-grid w-[4.25rem] justify-items-end">
                {STATES.map((s, i) => (
                  <span
                    key={s.label}
                    className={`rt-state col-start-1 row-start-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${s.cls}`}
                    style={slot(i, { "--row": r.row })}
                    data-first={i === 2 || undefined}
                  >
                    {s.label}
                  </span>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {/* Floating WhatsApp reminder */}
      <div className="rt-bubble absolute right-2 -bottom-4 left-6 sm:-right-4 sm:left-auto sm:w-72">
        <div className="rounded-2xl rounded-br-sm bg-[#d9fdd3] p-3 text-xs text-zinc-800 shadow-xl ring-1 ring-black/5 dark:bg-emerald-900 dark:text-emerald-50">
          <p className="font-semibold text-emerald-800 dark:text-emerald-300">WhatsApp reminder</p>
          <p className="mt-0.5">Hi Ravi, rent of ₹28,000 is due on the 5th. Pay by UPI:</p>
          <p className="mt-0.5 truncate font-medium text-emerald-700 underline dark:text-emerald-300">
            nrighar.3pandalabs.com/pay/…
          </p>
        </div>
      </div>

      {/* Status toasts */}
      <div className="absolute bottom-3 left-0 hidden h-10 w-52 sm:block lg:-left-6">
        {[
          ["Ravi opened the pay link", "0s"],
          ["Meera tapped “I've paid”", "-6s"],
          ["Agreement saved to vault", "-3s"],
        ].map(([t, d], i) => (
          <div
            key={t}
            className="rt-toast absolute inset-0 flex items-center gap-2 rounded-xl bg-zinc-900 px-3 py-2 text-[11px] font-medium text-white shadow-xl dark:bg-white dark:text-zinc-900"
            style={{ "--t": d } as CSSProperties}
            data-first={i === 0 || undefined}
          >
            <span className="size-1.5 shrink-0 rounded-full bg-emerald-400" />
            {t}
          </div>
        ))}
      </div>
    </div>
  );
}

function SectionHead({ kicker, title, accent }: { kicker: string; title: string; accent: string }) {
  return (
    <div className="text-center">
      <p className="text-xs font-semibold tracking-widest text-emerald-700 uppercase dark:text-emerald-400">{kicker}</p>
      <h2 className="rt-display mt-3 text-4xl leading-tight text-zinc-900 sm:text-5xl dark:text-zinc-50">
        {title} <span className="rt-shimmer italic">{accent}</span>
      </h2>
    </div>
  );
}

function Tile({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <div className="rt-tile flex flex-col rounded-3xl border border-zinc-200 bg-white/70 p-6 backdrop-blur dark:border-zinc-800 dark:bg-white/[0.03]">
      <div aria-hidden className="mb-6 min-h-28 rounded-2xl bg-zinc-50 p-4 dark:bg-zinc-900/70">
        {children}
      </div>
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">{body}</p>
    </div>
  );
}

function Arrow() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function House() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.7">
      <path d="M3 9.5 10 4l7 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1V9.5Z" strokeLinejoin="round" />
    </svg>
  );
}

function Lock() {
  return (
    <svg aria-hidden viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="3" y="7" width="10" height="7" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}
