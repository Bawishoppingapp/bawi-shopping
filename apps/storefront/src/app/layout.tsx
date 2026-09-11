import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageSelector, LocaleProvider, translate } from "@bawi/i18n";
import { getLocale } from "@bawi/i18n/server";
import { CartIcon, CartIconSkeleton } from "@/features/cart/components/cart-icon";
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
  title: "Bawi Shopping",
  description: "A multi-vendor fashion marketplace",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <LocaleProvider locale={locale}>
          <header className="flex items-center justify-between border-b border-neutral-200 p-3">
            <nav className="flex items-center gap-4 text-sm font-medium text-neutral-700">
              <Link href="/" className="text-neutral-900">
                {translate(locale, "common.appName")}
              </Link>
              <Link href="/search" className="hover:text-neutral-900">
                {translate(locale, "nav.search")}
              </Link>
              <Link href="/account" className="hover:text-neutral-900">
                {translate(locale, "nav.account")}
              </Link>
            </nav>
            <div className="flex items-center gap-4">
              <Suspense fallback={<CartIconSkeleton />}>
                <CartIcon />
              </Suspense>
              <LanguageSelector />
            </div>
          </header>
          {children}
          <footer className="mt-auto border-t border-neutral-200 p-6 text-sm text-neutral-600">
            <nav className="flex flex-wrap gap-x-6 gap-y-2">
              <Link href="/support" className="hover:text-neutral-900">
                {translate(locale, "footer.support")}
              </Link>
              <Link href="/legal/terms" className="hover:text-neutral-900">
                {translate(locale, "footer.terms")}
              </Link>
              <Link href="/legal/privacy" className="hover:text-neutral-900">
                {translate(locale, "footer.privacy")}
              </Link>
              <Link href="/legal/returns" className="hover:text-neutral-900">
                {translate(locale, "footer.returns")}
              </Link>
              <Link href="/legal/cookies" className="hover:text-neutral-900">
                {translate(locale, "footer.cookies")}
              </Link>
              <Link href="/legal/acceptable-use" className="hover:text-neutral-900">
                {translate(locale, "footer.acceptableUse")}
              </Link>
              <Link href="/legal/dmca" className="hover:text-neutral-900">
                {translate(locale, "footer.dmca")}
              </Link>
            </nav>
          </footer>
        </LocaleProvider>
      </body>
    </html>
  );
}
