"use client";

import { useState } from "react";
import Link from "next/link";
import { GradientBackdrop } from "@/components/GradientBackdrop";
import { WordmarkName, WordmarkTag } from "@/components/Wordmark";
import { requestPasswordReset } from "../login/actions";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await requestPasswordReset(email);
    setIsSubmitting(false);

    if (!result.ok) {
      setError("Something went wrong. Please try again.");
      return;
    }
    setSent(true);
  }

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
        {sent ? (
          <>
            <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Check your email</h1>
            {/* Worded so it says nothing about whether an account exists — the
                API deliberately doesn't tell us, and this page must not imply
                an answer either way. */}
            <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              If there&apos;s a RentVault account for <span className="font-medium">{email}</span>, we&apos;ve sent it a
              link to choose a new password. The link works once and expires in an hour.
            </p>
            <p className="mt-4 text-sm text-zinc-500">
              Nothing arrived? Check your spam folder, or{" "}
              <button
                type="button"
                onClick={() => setSent(false)}
                className="underline hover:text-zinc-900 dark:hover:text-zinc-50"
              >
                try a different address
              </button>
              .
            </p>
            <Link
              href="/login"
              className="mt-6 block text-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            >
              Back to sign in
            </Link>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Reset your password</h1>
            <p className="mb-6 text-sm text-zinc-500">
              Enter the email you sign in with and we&apos;ll send you a link to choose a new password.
            </p>

            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email</label>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />

            {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
            >
              {isSubmitting ? "..." : "Send reset link"}
            </button>

            <Link
              href="/login"
              className="mt-4 block text-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
            >
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </div>
  );
}
