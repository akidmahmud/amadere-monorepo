import type { Metadata } from "next";
import { Fraunces, Poppins, Inter, Hind_Siliguri, Plus_Jakarta_Sans, Noto_Sans_Bengali } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteCartDrawer } from "@/components/SiteCartDrawer";
import { WhatsappFloatingButton } from "@/components/WhatsappFloatingButton";
import { CartSummaryWidget } from "@/components/CartSummaryWidget";
import { BackToTopButton } from "@/components/BackToTopButton";
import { QueryProvider } from "@/components/QueryProvider";
import { AnalyticsScripts, type PublicAnalyticsConfig } from "@/components/AnalyticsScripts";
import type { WhatsappConfig } from "@/lib/whatsapp";
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

// Header/nav/announcement-bar-only, per amader-header-spec.md — Bangla nav
// labels and drawer text render in Noto Sans Bengali (the spec's required
// fallback; site-wide Bangla text elsewhere keeps using Hind Siliguri).
const plusJakarta = Plus_Jakarta_Sans({
  variable: "--font-plus-jakarta",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const notoBengali = Noto_Sans_Bengali({
  variable: "--font-noto-bengali",
  subsets: ["bengali"],
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

  // These 5 calls used to run as separate sequential `await`s — each one
  // paying its own round-trip latency back-to-back before the layout (and
  // everything nested under it, including the homepage) could render a
  // single byte. Promise.all fires them concurrently so the total wait is
  // whichever call is slowest, not the sum of all five.
  const [
    { data: siteInfo },
    { data: analyticsConfig },
    { data: whatsappConfig },
    // Fetched server-side so the nav's categories are in the very first HTML
    // response instead of appearing after a client-side fetch completes
    // post-hydration — that round trip was the "navbar takes too long to
    // load" delay.
    { data: categoriesNav },
    // Same fix as categories nav — the announcement bar was flashing in late
    // after a client-side fetch; server-fetching it here puts it in the
    // first HTML response instead.
    { data: announcements },
  ] = await Promise.all([
    safeGet("/api/v1/settings/site"),
    safeGet("/api/v1/analytics/config"),
    safeGet("/api/v1/whatsapp/config"),
    safeGet("/api/v1/categories/nav", { params: { query: { locale: locale.toUpperCase() } } }),
    safeGet("/api/v1/announcements", { params: { query: { locale: locale.toUpperCase() } } }),
  ]);

  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${poppins.variable} ${inter.variable} ${hindSiliguri.variable} ${plusJakarta.variable} ${notoBengali.variable} h-full antialiased`}
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
        <AnalyticsScripts
          config={
            (analyticsConfig as PublicAnalyticsConfig | undefined) ?? {
              ga4: null,
              gtm: null,
              meta: null,
              googleAds: null,
              tiktok: null,
              clarity: null,
              utmEnabled: false,
            }
          }
        />
        <NextIntlClientProvider>
          <QueryProvider>
            <SiteHeader
              initialLogoUrl={siteInfo?.logoUrl}
              initialCategoriesNav={categoriesNav}
              initialAnnouncements={announcements}
            />
            <div className="flex flex-1 flex-col">{children}</div>
            <SiteFooter initialLogoUrl={siteInfo?.logoUrl} initialCategoriesNav={categoriesNav} />
            <SiteCartDrawer />
            <WhatsappFloatingButton config={(whatsappConfig as WhatsappConfig | undefined) ?? null} />
            <CartSummaryWidget />
            <BackToTopButton />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
