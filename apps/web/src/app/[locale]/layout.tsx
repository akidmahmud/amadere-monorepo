import type { Metadata } from "next";
import { ckeditorGoogleFontsUrl } from "@amader/shared";
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
import { MobileStickyFooter } from "@/components/MobileStickyFooter";
import { QueryProvider } from "@/components/QueryProvider";
import { AnalyticsScripts, type PublicAnalyticsConfig } from "@/components/AnalyticsScripts";
import type { WhatsappConfig } from "@/lib/whatsapp";
import { safeGet } from "@/lib/api/client";
import "../globals.css";

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
    <html lang={locale} className="h-full antialiased">
      {/* Opens the connection (DNS + TLS) to promo-video embed platforms
          ahead of time, before any specific iframe actually needs one — the
          handshake itself is often a big chunk of the perceived "video takes
          a while to start" delay, and it's the same three origins regardless
          of which video loads. */}
      <link rel="preconnect" href="https://www.youtube.com" />
      <link rel="preconnect" href="https://www.tiktok.com" />
      <link rel="preconnect" href="https://www.instagram.com" />
      {/* Loaded under their real, literal family names — this is also how
          the site-wide default type stack (packages/ui's tokens.css: Roboto
          + Noto Sans Bengali) actually gets its typefaces, since both happen
          to already be in this same list; no separate link needed for them.
          Admin-authored content (product/blog descriptions) can also carry
          inline `font-family: "Poppins"` etc. styles from the admin's
          CKEditor font picker (a deliberately wider choice beyond the
          site's own default), which only resolve to the actual typeface if
          a stylesheet registers that exact literal name here. Same list as
          apps/admin's layout.tsx (shared via @amader/shared). */}
      <link rel="stylesheet" href={ckeditorGoogleFontsUrl()} precedence="default" />
      <body className="min-h-full flex flex-col pb-[55px] font-body md:pb-0">
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
              customScript: null,
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
            <MobileStickyFooter />
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
