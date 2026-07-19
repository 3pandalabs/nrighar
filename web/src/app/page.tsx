import Link from "next/link";
import { GradientBackdrop } from "@/components/GradientBackdrop";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <GradientBackdrop />
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-6">
        <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">NRIGhar</span>
        <Link
          href="/login"
          className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-900 transition-colors hover:bg-zinc-900 hover:text-white dark:border-zinc-700 dark:text-zinc-50"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 px-6 py-24 text-center">
        <h1 className="text-4xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50 sm:text-5xl">
          Your property in India. Managed from anywhere.
        </h1>
        <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          NRIGhar keeps NRI landlords on top of their rentals back home — tenants, monthly rent in
          INR and your home currency, and every agreement and document in one safe place.
        </p>
        <div className="flex flex-col gap-4 sm:flex-row">
          <Link
            href="/login"
            className="rounded-full bg-zinc-900 px-8 py-3 text-base font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
          >
            Get started
          </Link>
        </div>
      </main>

      <section className="mx-auto grid w-full max-w-4xl grid-cols-1 gap-8 px-6 pb-24 sm:grid-cols-3">
        <Step
          number="1"
          title="Track"
          description="Add your properties, tenants, and lease terms — rent amount, deposit, due date."
        />
        <Step
          number="2"
          title="Collect"
          description="See who's paid and who hasn't each month, in INR and your home currency, with one-tap WhatsApp reminders."
        />
        <Step
          number="3"
          title="Store"
          description="Rent agreements, tenant KYC, and property papers in a private vault you can open from any timezone."
        />
      </section>

      <footer className="mx-auto w-full max-w-5xl px-6 py-8 text-center text-sm text-zinc-500">
        &copy; {new Date().getFullYear()} 3PandaLabs
      </footer>
    </div>
  );
}

function Step({ number, title, description }: { number: string; title: string; description: string }) {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-900 text-sm font-semibold text-white dark:bg-white dark:text-zinc-900">
        {number}
      </div>
      <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
    </div>
  );
}
