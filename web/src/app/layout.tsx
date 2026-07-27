import type { Metadata } from "next";
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
        <footer className="mx-auto w-full max-w-5xl px-6 py-8 text-center text-sm text-zinc-500">
          <p>&copy; 3PandaLabs LLC, USA.</p>
          <p>All rights reserved.</p>
        </footer>
      </body>
    </html>
  );
}
