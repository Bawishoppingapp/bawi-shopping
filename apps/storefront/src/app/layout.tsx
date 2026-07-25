import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageSelector, LocaleProvider } from "@bawi/i18n";
import { getLocale } from "@bawi/i18n/server";
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
          <header className="flex justify-end border-b border-neutral-200 p-3">
            <LanguageSelector />
          </header>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
