"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { resetPassword } from "../login/actions";

const ERROR_MESSAGES: Record<string, string> = {
  invalid_or_expired_token:
    "This link has expired or was already used. Request a new one and try again.",
};

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Checked here rather than server-side: the API takes one password and has
    // no notion of a confirmation field, so this is purely a typo guard.
    if (password !== confirm) {
      setError("Those two passwords don't match.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    const result = await resetPassword(token, password);
    setIsSubmitting(false);

    if (!result.ok) {
      setError(ERROR_MESSAGES[result.error] ?? "Something went wrong. Please try again.");
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <>
        <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Password changed</h1>
        {/* The API drops every session on reset, so any other device that was
            signed in has been signed out. Say so — for someone recovering a
            compromised account that's the reassurance they came for. */}
        <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
          You can sign in with your new password now. Anywhere else you were signed in has been signed out.
        </p>
        <button
          type="button"
          onClick={() => router.push("/login")}
          className="mt-6 w-full rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
        >
          Go to sign in
        </button>
      </>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <h1 className="mb-2 text-xl font-semibold text-zinc-900 dark:text-zinc-50">Choose a new password</h1>
      <p className="mb-6 text-sm text-zinc-500">At least 8 characters.</p>

      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">New password</label>
      <input
        type="password"
        required
        minLength={8}
        autoFocus
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />

      <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">Confirm new password</label>
      <input
        type="password"
        required
        minLength={8}
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
      >
        {isSubmitting ? "..." : "Change password"}
      </button>

      <Link
        href="/forgot-password"
        className="mt-4 block text-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
      >
        Request a new link
      </Link>
    </form>
  );
}
