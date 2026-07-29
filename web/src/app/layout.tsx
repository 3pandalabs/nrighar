import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RentVault",
  description:
    "Manage your rental property in India from anywhere — tenants, rent, and documents in one place, built for NRIs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <div className="flex-1">{children}</div>
        <footer className="border-t border-zinc-200 px-6 py-8 dark:border-zinc-800">
          <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <span>&copy; 3PandaLabs LLC, USA.</span>
            <span className="flex items-center gap-4">
              <Link href="/contact" className="hover:text-zinc-900 dark:hover:text-zinc-50">
                Contact us
              </Link>
              <span>All rights reserved.</span>
            </span>
          </div>
        </footer>
      </body>
    </html>
  );
}
