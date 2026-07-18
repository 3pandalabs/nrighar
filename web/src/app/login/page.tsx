"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [role, setRole] = useState<"owner" | "tenant">("owner");
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const supabase = createClient();

    if (mode === "sign-up") {
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
        setIsSubmitting(false);
        return;
      }
      if (data.user) {
        await supabase.from("profiles").upsert({ id: data.user.id, role });
        if (role === "tenant") {
          await supabase.from("tenant_profiles").upsert({ user_id: data.user.id, full_name: "", email });
        }
      }
      router.push(role === "tenant" ? "/tenant" : "/dashboard");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setIsSubmitting(false);
      return;
    }

    // Route by the account's actual role, not the toggle — the toggle is a
    // hint for sign-up; existing accounts go where they belong.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();

    router.push(profile?.role === "tenant" ? "/tenant" : "/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-6 dark:bg-black">
      <Link href="/" className="mb-8 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        NRIGhar
      </Link>

      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-2xl border border-zinc-200 bg-white p-8 dark:border-zinc-800 dark:bg-zinc-950"
      >
        <h1 className="mb-4 text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          {mode === "sign-in" ? "Sign in" : "Create an account"}
        </h1>

        <div className="mb-6 grid grid-cols-2 gap-1 rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
          {(["owner", "tenant"] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className={
                role === r
                  ? "rounded-full bg-white px-4 py-1.5 text-sm font-medium text-zinc-900 shadow-sm dark:bg-zinc-700 dark:text-zinc-50"
                  : "rounded-full px-4 py-1.5 text-sm text-zinc-500"
              }
            >
              {r === "owner" ? "I'm an owner" : "I'm a tenant"}
            </button>
          ))}
        </div>

        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Email
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />

        <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Password
        </label>
        <input
          type="password"
          required
          minLength={6}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        />

        {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-full bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {isSubmitting ? "..." : mode === "sign-in" ? "Sign in" : "Sign up"}
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
          }}
          className="mt-4 w-full text-center text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-50"
        >
          {mode === "sign-in" ? "Need an account? Sign up" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
