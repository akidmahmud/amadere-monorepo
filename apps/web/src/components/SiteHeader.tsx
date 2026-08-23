"use client";

import { useEffect, useState } from "react";
import {
  AnnouncementBar,
  Header,
  Nav,
  useMobileNavDrawerStore,
} from "@amader/ui";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, Link } from "@/i18n/navigation";
import { toApiLocale } from "@/lib/api-locale";
import { useCartQuery } from "@/hooks/useCart";
import { useMe } from "@/hooks/useAuth";
import { useWishlist } from "@/hooks/useAccount";
import { useSearchSuggestions } from "@/hooks/useSearch";
import { useSiteInfo } from "@/hooks/useSiteInfo";
import { useNavMenu } from "@/hooks/useNavMenu";
import { useAnnouncements } from "@/hooks/useAnnouncements";
import { IMG, toDisplayImageUrl } from "@/lib/media";
import dynamic from "next/dynamic";

// Hidden until the hamburger is tapped, but its code shipped in the
// initial bundle on every page. Loaded as its own chunk after hydration
// instead — nothing renders before it arrives, because the drawer is
// closed by default.
const MobileDrawer = dynamic(
  () => import("@amader/ui").then((m) => m.MobileDrawer),
  { ssr: false },
);

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export interface SiteHeaderProps {
  /** Server-fetched logo URL, so the real logo is in the first paint instead
   * of flashing the fallback mark while the client-side fetch is in flight. */
  initialLogoUrl?: string | null;
  /** Server-fetched nav menu, so the header/drawer's nav is in the first
   * paint instead of appearing after a client-side fetch resolves. */
  initialNavMenu?: Parameters<typeof useNavMenu>[1];
  /** Server-fetched announcements, so the bar is in the first paint instead
   * of flashing in after a client-side fetch resolves. */
  initialAnnouncements?: Parameters<typeof useAnnouncements>[1];
}

export function SiteHeader({
  initialLogoUrl,
  initialNavMenu,
  initialAnnouncements,
}: SiteHeaderProps = {}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { data: cart } = useCartQuery(toApiLocale(locale));
  const cartCount =
    cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const { data: me } = useMe();
  const { data: wishlist } = useWishlist(toApiLocale(locale), !!me);
  const { data: siteInfo } = useSiteInfo();
  const { data: navMenu } = useNavMenu(toApiLocale(locale), initialNavMenu);
  const { data: announcements } = useAnnouncements(
    toApiLocale(locale),
    initialAnnouncements,
  );
  // Served resized from the CDN. This one image bypassed every
  // optimisation the app has: measured live at 1,773,628 bytes for a
  // logo rendered at max-h-[56px], on every page, and preloaded.
  const logoUrl = toDisplayImageUrl(
    siteInfo?.logoUrl ?? initialLogoUrl,
    IMG.logo,
  );
  const logoPaddingPx = siteInfo?.logoPaddingPx ?? 0;
  const logoMarginPx = siteInfo?.logoMarginPx ?? 0;

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounced(searchQuery, 250);
  const { data: suggestions, isLoading: suggestionsLoading } =
    useSearchSuggestions(debouncedQuery, toApiLocale(locale));

  const otherLocale = locale === "en" ? "bn" : "en";
  const switchLocale = () => router.replace(pathname, { locale: otherLocale });

  // Spec 5.2: the drawer closes on route change, in addition to overlay
  // tap/×/Escape (which Radix Dialog already handles inside MobileDrawer).
  const closeDrawer = useMobileNavDrawerStore((s) => s.close);
  useEffect(() => {
    closeDrawer();
  }, [pathname, closeDrawer]);

  // Items already come back sorted by sortOrder (ascending) from the backend
  // — array order IS spec 6.1's "priority" order, no separate field needed.
  const categories = (navMenu ?? []).map((item) => ({
    key: `nav-${item.id}`,
    href: item.href,
    label: item.label,
    children: item.children.map((child) => ({
      key: `nav-${child.id}`,
      href: child.href,
      label: child.label,
    })),
  }));

  return (
    <>
      <AnnouncementBar
        items={announcements ?? []}
        dismissLabel={t("header.dismissAnnouncement")}
        linkComponent={Link}
        speedSeconds={siteInfo?.announcementSpeedSeconds}
      />
      <Header
        brandHref="/"
        brandMark="আমাদের"
        logoUrl={logoUrl}
        logoPaddingPx={logoPaddingPx}
        logoMarginPx={logoMarginPx}
        homeHref="/"
        homeLabel={t("header.home")}
        blogHref="/blog"
        blogLabel={t("header.blog")}
        searchPlaceholder={t("header.searchPlaceholder")}
        searchAriaLabel={t("header.searchAria")}
        onSearchSubmit={(query) =>
          query.trim() &&
          router.push(`/search?q=${encodeURIComponent(query.trim())}`)
        }
        onSearchQueryChange={setSearchQuery}
        searchSuggestions={
          searchQuery.trim().length >= 2
            ? (close) => (
                <div className="max-h-[70vh] overflow-y-auto py-1.5">
                  {suggestionsLoading ? (
                    <p className="px-4 py-3 text-center font-body text-xs text-muted">
                      Searching…
                    </p>
                  ) : suggestions?.items?.length ? (
                    <>
                      {suggestions.items.map((hit) => (
                        <Link
                          key={hit.slug}
                          href={`/products/${hit.slug}`}
                          onClick={close}
                          className="flex items-center gap-3 px-4 py-2 hover:bg-beige"
                        >
                          <span className="h-10 w-10 shrink-0 overflow-hidden rounded-[8px] bg-beige">
                            {hit.primaryImageUrl && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                loading="lazy"
                                src={toDisplayImageUrl(hit.primaryImageUrl)}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-body text-[13px] text-ink">
                              {hit.name}
                            </span>
                            {/* salePrice is non-null only when a sale is
                                genuinely active and below the regular price
                                (enforced in postgres-search.provider), so
                                its presence alone is enough to show the
                                struck-through original next to it. */}
                            <span className="flex items-baseline gap-1.5 font-ui text-xs font-semibold text-green-deep">
                              <span>৳{hit.salePrice ?? hit.price}</span>
                              {hit.salePrice && hit.price && (
                                <span className="font-normal text-muted line-through">
                                  ৳{hit.price}
                                </span>
                              )}
                            </span>
                          </span>
                        </Link>
                      ))}
                      <Link
                        href={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
                        onClick={close}
                        className="block border-t border-line px-4 py-2 text-center font-ui text-xs font-semibold text-green hover:bg-beige"
                      >
                        View all results for &quot;{searchQuery.trim()}&quot;
                      </Link>
                    </>
                  ) : (
                    <p className="px-4 py-3 text-center font-body text-xs text-muted">
                      No products found for &quot;{searchQuery.trim()}&quot;.
                    </p>
                  )}
                </div>
              )
            : undefined
        }
        trackOrderHref="/track"
        trackOrderLabel={t("header.trackOrder")}
        accountHref={me ? "/account" : "/login"}
        accountLabel={t("header.account")}
        wishlistHref={me ? "/account/wishlist" : "/login"}
        wishlistLabel={t("header.wishlist")}
        wishlistCount={wishlist?.length}
        cartLabel={t("header.cart")}
        cartCount={cartCount}
        localeSwitchLabel={t("header.localeSwitch")}
        onLocaleSwitch={switchLocale}
        mobileMenuLabel={t("header.menu")}
        linkComponent={Link}
      />
      <Nav
        allProductsHref="/products"
        allProductsLabel={t("nav.allProducts")}
        items={categories}
        activeHref={pathname}
        linkComponent={Link}
      />
      <MobileDrawer
        brandHref="/"
        brandMark="আমাদের"
        logoUrl={logoUrl}
        logoPaddingPx={logoPaddingPx}
        logoMarginPx={logoMarginPx}
        closeLabel={t("header.close")}
        allProductsHref="/products"
        allProductsLabel={t("nav.allProducts")}
        categories={categories}
        trackOrderHref="/track"
        trackOrderLabel={t("header.trackOrder")}
        accountHref={me ? "/account" : "/login"}
        accountLabel={t("header.account")}
        wishlistHref={me ? "/account/wishlist" : "/login"}
        wishlistLabel={t("header.wishlist")}
        localeSwitchLabel={t("header.localeSwitch")}
        onLocaleSwitch={switchLocale}
        linkComponent={Link}
      />
    </>
  );
}
