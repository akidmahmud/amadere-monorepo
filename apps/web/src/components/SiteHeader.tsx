"use client";

import { useEffect, useState } from "react";
import { Header, Nav } from "@amader/ui";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, Link } from "@/i18n/navigation";
import { navConfig } from "@/config/nav";
import { toApiLocale } from "@/lib/api-locale";
import { useCartQuery } from "@/hooks/useCart";
import { useMe } from "@/hooks/useAuth";
import { useSearchSuggestions } from "@/hooks/useSearch";
import { useSiteInfo } from "@/hooks/useSiteInfo";
import { useNavCollections } from "@/hooks/useNavCollections";
import { toDisplayImageUrl } from "@/lib/media";

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
}

export function SiteHeader({ initialLogoUrl }: SiteHeaderProps = {}) {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const { data: cart } = useCartQuery(toApiLocale(locale));
  const cartCount = cart?.items.reduce((sum, item) => sum + item.quantity, 0) ?? 0;
  const { data: me } = useMe();
  const { data: siteInfo } = useSiteInfo();
  const { data: navCollections } = useNavCollections(toApiLocale(locale));
  const logoUrl = siteInfo?.logoUrl ?? initialLogoUrl ?? undefined;

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebounced(searchQuery, 250);
  const { data: suggestions, isLoading: suggestionsLoading } = useSearchSuggestions(debouncedQuery, toApiLocale(locale));

  const otherLocale = locale === "en" ? "bn" : "en";

  const items = [
    ...navConfig.map((item) => ({
      key: item.key,
      href: item.href,
      hasChildren: undefined as boolean | undefined,
      label: t(`nav.${item.key}`),
    })),
    ...(navCollections ?? []).map((collection) => ({
      key: `collection-${collection.slug}`,
      href: `/collections/${collection.slug}`,
      hasChildren: undefined,
      label: collection.name,
    })),
  ];

  return (
    <>
      <Header
        brandHref="/"
        brandMark="আমাদের"
        logoUrl={logoUrl}
        searchPlaceholder={t("header.searchPlaceholder")}
        searchAriaLabel={t("header.searchAria")}
        onSearchSubmit={(query) => query.trim() && router.push(`/search?q=${encodeURIComponent(query.trim())}`)}
        onSearchQueryChange={setSearchQuery}
        searchSuggestions={
          searchQuery.trim().length >= 2 ? (
            <div className="max-h-[70vh] overflow-y-auto py-1.5">
              {suggestionsLoading ? (
                <p className="px-4 py-3 text-center font-body text-xs text-muted">Searching…</p>
              ) : suggestions?.items?.length ? (
                <>
                  {suggestions.items.map((hit) => (
                    <Link
                      key={hit.slug}
                      href={`/products/${hit.slug}`}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-beige"
                    >
                      <span className="h-10 w-10 shrink-0 overflow-hidden rounded-[8px] bg-beige">
                        {hit.primaryImageUrl && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={toDisplayImageUrl(hit.primaryImageUrl)} alt="" className="h-full w-full object-cover" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-body text-[13px] text-ink">{hit.name}</span>
                        <span className="block font-ui text-xs font-semibold text-green-deep">
                          ৳{hit.salePrice ?? hit.price}
                        </span>
                      </span>
                    </Link>
                  ))}
                  <Link
                    href={`/search?q=${encodeURIComponent(searchQuery.trim())}`}
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
          ) : undefined
        }
        trackOrderHref="/track"
        trackOrderLabel={t("header.trackOrder")}
        accountHref={me ? "/account" : "/login"}
        accountLabel={t("header.account")}
        cartLabel={t("header.cart")}
        cartCount={cartCount}
        localeSwitchLabel={t("header.localeSwitch")}
        onLocaleSwitch={() => router.replace(pathname, { locale: otherLocale })}
        linkComponent={Link}
      />
      <Nav items={items} activeHref={pathname} linkComponent={Link} />
    </>
  );
}
