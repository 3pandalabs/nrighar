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

const description =
  "Manage your rental property in India from anywhere — tenants, rent, and documents in one place, built for NRIs.";
const homeTitle = "RentVault — Manage your rental property in India from anywhere | by 3PandaLabs";

// Brand consistency rules (brand repo, brand.md, DECIDED 2026-11-22): home
// title "<App> — <line> | by 3PandaLabs", other pages "<Page> — <App>" (the
// template below — child pages set only their page name), and share tags
// with a 1200x630 /og.png on every public page.
export const metadata: Metadata = {
  metadataBase: new URL("https://nrighar.3pandalabs.com"),
  title: {
    default: homeTitle,
    template: "%s — RentVault",
  },
  description,
  openGraph: {
    title: homeTitle,
    description,
    siteName: "RentVault by 3PandaLabs",
    type: "website",
    url: "/",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "RentVault by 3PandaLabs" }],
  },
  twitter: {
    card: "summary_large_image",
    title: homeTitle,
    description,
    images: ["/og.png"],
  },
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
              <Link href="/privacy" className="hover:text-zinc-900 dark:hover:text-zinc-50">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-zinc-900 dark:hover:text-zinc-50">
                Terms
              </Link>
              <Link href="/contact" className="hover:text-zinc-900 dark:hover:text-zinc-50">
                Contact us
              </Link>
              <span>All rights reserved.</span>
            </span>
            <p className="m-0 mt-1 basis-full text-xs text-zinc-500 dark:text-zinc-400">
              Built by pandas. Loved by people.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
