// Long-form layout for the public legal pages (/privacy, /terms). Same shape
// as the other 3PandaLabs apps' legal pages (header with a way back to the
// site, big title, effective date, a ruled summary, contents, then prose),
// in RentVault's own zinc + gold palette and the contact page's header.
// Server components only. The site footer comes from the root layout.
import Link from "next/link";
import { GradientBackdrop } from "@/components/GradientBackdrop";
import { WordmarkName, WordmarkTag } from "@/components/Wordmark";

// Same public support alias as /contact (see the note there on why it is not
// the org's sending address).
export const CONTACT_EMAIL = "support@3pandalabs.com";
export const LAST_UPDATED = "November 22, 2026";

export type TocEntry = { id: string; title: string };

export function LegalPage({
  title,
  intro,
  toc,
  children,
}: {
  title: string;
  intro: React.ReactNode;
  toc: TocEntry[];
  children: React.ReactNode;
}) {
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
          href="/"
          className="rounded-full px-4 py-2 text-sm whitespace-nowrap text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Back to site
        </Link>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 pt-2 pb-24">
        <article>
          <h1 className="text-4xl font-semibold tracking-tight text-balance text-zinc-900 sm:text-5xl dark:text-zinc-50">
            {title}
          </h1>
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">Last updated: {LAST_UPDATED}</p>
          <div className="mt-6 space-y-4 border-l-2 border-[#b98d4f]/50 pl-4 text-lg leading-relaxed text-zinc-700 dark:text-zinc-300">
            {intro}
          </div>
          {toc.length ? (
            <nav
              aria-label="Contents"
              className="mt-10 rounded-2xl border border-zinc-200 bg-white/70 p-5 dark:border-zinc-800 dark:bg-zinc-950/70"
            >
              <p className="font-mono text-xs tracking-widest text-[#b98d4f] uppercase">Contents</p>
              <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-zinc-500">
                {toc.map((e) => (
                  <li key={e.id}>
                    <a href={`#${e.id}`} className="text-zinc-700 hover:underline dark:text-zinc-300">
                      {e.title}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          ) : null}
          <div className="[&_li>strong]:font-medium [&_strong]:text-zinc-900 dark:[&_strong]:text-zinc-100">{children}</div>
        </article>
      </main>
    </div>
  );
}

export function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-6">
      <h2 className="mt-12 mb-3 text-xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h2>
      <div className="space-y-4 leading-relaxed text-zinc-600 dark:text-zinc-400 [&_li]:leading-relaxed">{children}</div>
    </section>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return <h3 className="mt-8 mb-2 text-base font-semibold text-zinc-800 dark:text-zinc-200">{children}</h3>;
}

export function UL({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc space-y-2 pl-5">{children}</ul>;
}

export function Mail({ to = CONTACT_EMAIL }: { to?: string }) {
  return (
    <a href={`mailto:${to}`} className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-50">
      {to}
    </a>
  );
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-medium text-zinc-900 underline underline-offset-2 dark:text-zinc-50">
      {children}
    </Link>
  );
}
