import type { Metadata } from "next";
import { ckeditorGoogleFontsUrl } from "@amader/shared";
import { ProductCardStyleProvider, type ProductCardStyle } from "@amader/ui";
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
import { ToastProvider } from "@/components/ToastProvider";
import { AnalyticsScripts, type PublicAnalyticsConfig } from "@/components/AnalyticsScripts";
import { UserIdentityTracker } from "@/components/UserIdentityTracker";
import type { WhatsappConfig } from "@/lib/whatsapp";
import { safeGet } from "@/lib/api/client";
import { googleSans } from "@/fonts";
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
    // Fetched server-side so the nav menu is in the very first HTML response
    // instead of appearing after a client-side fetch completes
    // post-hydration — that round trip was the "navbar takes too long to
    // load" delay.
    { data: navMenu },
    // Same fix as the nav menu — the announcement bar was flashing in late
    // after a client-side fetch; server-fetching it here puts it in the
    // first HTML response instead.
    { data: announcements },
  ] = await Promise.all([
    safeGet("/api/v1/settings/site"),
    safeGet("/api/v1/analytics/config"),
    safeGet("/api/v1/whatsapp/config"),
    safeGet("/api/v1/menu", { params: { query: { locale: locale.toUpperCase() } } }),
    safeGet("/api/v1/announcements", { params: { query: { locale: locale.toUpperCase() } } }),
  ]);

  return (
    <html lang={locale} className={`h-full antialiased ${googleSans.variable}`}>
      {/* Admin-uploaded via Settings > Logo & Banners > Favicon — falls back
          to the static default in public/ when unset. Replaces the old
          app/icon.png file-convention favicon (which Next auto-injects its
          own <link> for) so there's exactly one favicon link, no ambiguity
          between a static build-time icon and this runtime-configurable one. */}
      <link rel="icon" href={siteInfo?.faviconUrl ?? "/favicon-default.png"} />
      {/* Opens the connection (DNS + TLS) to promo-video embed platforms
          ahead of time, before any specific iframe actually needs one — the
          handshake itself is often a big chunk of the perceived "video takes
          a while to start" delay, and it's the same three origins regardless
          of which video loads. */}
      <link rel="preconnect" href="https://www.youtube.com" />
      <link rel="preconnect" href="https://www.tiktok.com" />
      <link rel="preconnect" href="https://www.instagram.com" />
      {/* Glyph-coverage fallbacks only now, not the primary typeface — the
          self-hosted Google Sans (fonts.ts) covers Latin, but has no Bengali
          glyphs at all, so Noto Sans Bengali stays render-blocking here for
          every Bengali character on the site; Open Sans backstops any Latin
          glyph Google Sans itself doesn't cover. The old 'Google Sans Flex'
          CDN load (and the deferred ~17-family CKEditor picker load) are
          gone — inline font-family from admin-authored content is now
          force-overridden site-wide (globals.css), so loading fonts nothing
          will ever render was pure waste. */}
      <link rel="stylesheet" href={ckeditorGoogleFontsUrl(["Open Sans", "Noto Sans Bengali"])} precedence="default" />
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
            <ToastProvider>
              <UserIdentityTracker />
              <SiteHeader
                initialLogoUrl={siteInfo?.logoUrl}
                initialNavMenu={navMenu}
                initialAnnouncements={announcements}
              />
              <ProductCardStyleProvider value={(siteInfo?.productCardStyle as ProductCardStyle | undefined) ?? "ONE"}>
                <div className="flex flex-1 flex-col">{children}</div>
              </ProductCardStyleProvider>
              <SiteFooter initialLogoUrl={siteInfo?.logoUrl} initialNavMenu={navMenu} />
              <SiteCartDrawer />
              <WhatsappFloatingButton config={(whatsappConfig as WhatsappConfig | undefined) ?? null} />
              <CartSummaryWidget />
              <BackToTopButton />
              <MobileStickyFooter />
            </ToastProvider>
          </QueryProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
