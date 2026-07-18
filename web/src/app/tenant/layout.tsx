import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { tenantSignOut } from "./actions";

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 dark:bg-black">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/tenant" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            NRIGhar <span className="text-sm font-normal text-zinc-500">· tenant</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-zinc-500 sm:inline">{user.email}</span>
            <form action={tenantSignOut}>
              <button
                type="submit"
                className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
