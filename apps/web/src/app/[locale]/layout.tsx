import type { Metadata } from "next";
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
import {
  AnalyticsScripts,
  type PublicAnalyticsConfig,
} from "@/components/AnalyticsScripts";
import { UserIdentityTracker } from "@/components/UserIdentityTracker";
import type { WhatsappConfig } from "@/lib/whatsapp";
import { safeGet } from "@/lib/api/client";
import { googleSans } from "@/fonts";
import "../globals.css";
import { IMG, toDisplayImageUrl } from "@/lib/media";

const DEFAULT_TITLE = "আমাদের";
const DEFAULT_DESCRIPTION = "আমাদের — organic & natural products";

// Site-wide fallback (Settings > Site SEO Settings, apps/backend's
// SiteInfoDto.seo*) — shown for the homepage/root URL and any page that
// doesn't set its own `openGraph`/`title`/`description` via its own
// generateMetadata (products/categories/brands/blog posts already do, via
// the per-entity `seo` module, and simply override these at that level).
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const { data: siteInfo } = await safeGet("/api/v1/settings/site");
  const title: string = siteInfo?.seoTitle || DEFAULT_TITLE;
  const description: string = siteInfo?.seoDescription || DEFAULT_DESCRIPTION;
  const ogImageUrl: string | undefined = siteInfo?.seoImageUrl ?? undefined;

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      locale: locale === "bn" ? "bn_BD" : "en_US",
      images: ogImageUrl
        ? [{ url: ogImageUrl, width: 1200, height: 630 }]
        : undefined,
    },
    twitter: {
      card: ogImageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: ogImageUrl ? [ogImageUrl] : undefined,
    },
  };
}

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
    // Same fix again — the footer is on every page, so server-fetching it
    // here avoids a client-side fetch and the pop-in that would come with it.
    { data: footer },
  ] = await Promise.all([
    safeGet("/api/v1/settings/site"),
    safeGet("/api/v1/analytics/config"),
    safeGet("/api/v1/whatsapp/config"),
    safeGet("/api/v1/menu", {
      params: { query: { locale: locale.toUpperCase() } },
    }),
    safeGet("/api/v1/announcements", {
      params: { query: { locale: locale.toUpperCase() } },
    }),
    safeGet("/api/v1/footer", {
      params: { query: { locale: locale.toUpperCase() } },
    }),
  ]);

  return (
    <html lang={locale} className={`h-full antialiased ${googleSans.variable}`}>
      {/* Admin-uploaded via Settings > Logo & Banners > Favicon — falls back
          to the static default in public/ when unset. Replaces the old
          app/icon.png file-convention favicon (which Next auto-injects its
          own <link> for) so there's exactly one favicon link, no ambiguity
          between a static build-time icon and this runtime-configurable one. */}
      <link
        rel="icon"
        href={
          toDisplayImageUrl(siteInfo?.faviconUrl, IMG.icon) ??
          "/favicon-default.png"
        }
      />
      {/* iOS home-screen icon — Safari doesn't reliably read icons out of
          manifest.ts (app/manifest.ts) for "Add to Home Screen", it wants
          this explicit link. Same admin-uploaded favicon, not a separate
          asset — a good square favicon works fine here too. */}
      <link
        rel="apple-touch-icon"
        href={
          toDisplayImageUrl(siteInfo?.faviconUrl, IMG.icon) ??
          "/favicon-default.png"
        }
      />
      {/* Tints mobile browser chrome (address bar) and the PWA splash
          screen to match the header's own nav-bar green, so the site reads
          as the same brand from the very first frame — same value as
          manifest.ts's theme_color, kept in sync manually since the two
          files can't share a constant across a client/server boundary this
          cleanly for one hex value. */}
      <meta name="theme-color" content="#21713d" />
      {/* Opens the connection (DNS + TLS) to promo-video embed platforms
          ahead of time, before any specific iframe actually needs one — the
          handshake itself is often a big chunk of the perceived "video takes
          a while to start" delay, and it's the same three origins regardless
          of which video loads. */}
      <link rel="preconnect" href="https://www.youtube.com" />
      <link rel="preconnect" href="https://www.tiktok.com" />
      <link rel="preconnect" href="https://www.instagram.com" />
      {/* No web-font stylesheet here on purpose.
          Open Sans and Noto Sans Bengali used to load from Google's CDN as
          fallbacks. They cost two serial cross-origin round trips in the
          critical rendering path — measured at 624 ms for the 2.9 KiB
          stylesheet plus 1,558 ms for the font file, on a page whose whole
          FCP was 3.6 s — and the stylesheet alone declared 62 @font-face
          rules across 13 files.

          Both were removable, but only one of those was obvious:

          Open Sans was pure waste. Google Sans (self-hosted, fonts.ts) is the
          primary face and covers Latin, so Open Sans never rendered a glyph.

          Noto Sans Bengali was the real question, and the comment that used
          to sit here said Google Sans's Bengali conjunct support was "not
          verified either way". It has been now. Inspecting feature tags was
          misleading — Google Sans does not declare `blwf` (below-base forms),
          which looks fatal for Bengali. But shaping real conjunct-heavy words
          through HarfBuzz, the same engine the browser uses, shows the
          conjuncts DO form: ক্রয় collapses 4 codepoints to 2 glyphs,
          স্বাস্থ্য 9 to 6, with no orphaned hasanta in any of them. It gets
          there via cjct/vatu and precomposed conjunct glyphs instead. Noto
          Sans Bengali was verified as the control in the same run.

          If Bengali ever does look wrong, re-add it here — but self-host it
          the way fonts.ts self-hosts Google Sans rather than paying for the
          cross-origin hops again. */}
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
              <ProductCardStyleProvider
                value={
                  (siteInfo?.productCardStyle as
                    ProductCardStyle | undefined) ?? "ONE"
                }
              >
                <div className="flex flex-1 flex-col">{children}</div>
              </ProductCardStyleProvider>
              <SiteFooter footer={footer} initialLogoUrl={siteInfo?.logoUrl} />
              <SiteCartDrawer />
              <WhatsappFloatingButton
                config={(whatsappConfig as WhatsappConfig | undefined) ?? null}
              />
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
