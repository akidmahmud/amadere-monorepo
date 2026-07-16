import type { Metadata } from "next";
import { Fraunces, Poppins, Inter, Hind_Siliguri } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteCartDrawer } from "@/components/SiteCartDrawer";
import { QueryProvider } from "@/components/QueryProvider";
import { safeGet } from "@/lib/api/client";
import "../globals.css";

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  display: "swap",
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const hindSiliguri = Hind_Siliguri({
  variable: "--font-hind-siliguri",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "আমাদের",
  description: "আমাদের — organic & natural products",
};

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  const { data: siteInfo } = await safeGet("/api/v1/settings/site");

  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${poppins.variable} ${inter.variable} ${hindSiliguri.variable} h-full antialiased`}
    >
      {/* Opens the connection (DNS + TLS) to promo-video embed platforms
          ahead of time, before any specific iframe actually needs one — the
          handshake itself is often a big chunk of the perceived "video takes
          a while to start" delay, and it's the same three origins regardless
          of which video loads. */}
      <link rel="preconnect" href="https://www.youtube.com" />
      <link rel="preconnect" href="https://www.tiktok.com" />
      <link rel="preconnect" href="https://www.instagram.com" />
      <body className="min-h-full flex flex-col font-body">
        <NextIntlClientProvider>
          <QueryProvider>
            <SiteHeader initialLogoUrl={siteInfo?.logoUrl} />
            <div className="flex flex-1 flex-col">{children}</div>
            <SiteFooter />
            <SiteCartDrawer />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
