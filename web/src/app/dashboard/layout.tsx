import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "./actions";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Overview" },
  { href: "/dashboard/properties", label: "Properties" },
  { href: "/dashboard/tenants", label: "Tenants" },
  { href: "/dashboard/rent", label: "Rent" },
  { href: "/dashboard/documents", label: "Documents" },
  { href: "/dashboard/settings", label: "Settings" },
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            NRIGhar
          </Link>
          <div className="flex items-center gap-4">
            <span className="hidden text-sm text-zinc-500 sm:inline">{user.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-900"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav className="mx-auto flex w-full max-w-5xl gap-1 overflow-x-auto px-6 pb-2">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-full px-4 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
