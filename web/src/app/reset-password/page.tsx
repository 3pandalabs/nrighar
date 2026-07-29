import Link from "next/link";
import { GradientBackdrop } from "@/components/GradientBackdrop";
import { WordmarkName, WordmarkTag } from "@/components/Wordmark";
import { ResetPasswordForm } from "./reset-form";

// Server component: pulls the token out of the emailed link and hands it to
// the client form. The token is never validated here — only the API can do
// that, and doing it on render would burn a single-use token on a page view.
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <GradientBackdrop />
      <span className="mb-8 inline-flex items-center">
        <Link href="/" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          <WordmarkName />
        </Link>
        <WordmarkTag />
      </span>

      <div className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white/90 p-8 shadow-xl shadow-zinc-900/5 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-950/90">
        {token ? (
          <ResetPasswordForm token={token} />
        ) : (
          <>
            <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Link incomplete</h1>
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              This reset link is missing its token — some email clients cut long links in half. Try opening it again
              from the email, or request a new one.
            </p>
            <Link
              href="/forgot-password"
              className="mt-6 block text-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            >
              Request a new link
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
