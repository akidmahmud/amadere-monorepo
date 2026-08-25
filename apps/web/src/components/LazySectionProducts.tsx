"use client";

import { useEffect, useRef, useState } from "react";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { components } from "@/lib/api/schema";
import { toProductCardData, type ProductCardData } from "@/lib/product-card-mapper";
import { TabbedCollectionCarouselSection } from "@/components/TabbedCollectionCarouselSection";
import { TopSellingProductsSectionClient } from "@/components/TopSellingProductsSectionClient";
import { FeaturedDealsSectionClient } from "@/components/FeaturedDealsSectionClient";
import { ProductCarouselSectionClient } from "@/components/ProductCarouselSectionClient";

type PublicProduct = components["schemas"]["PublicProductDto"];

/**
 * Height reserved per variant while loading, so the row does not jump when its
 * products arrive.
 *
 * These are MEASURED, not estimated — rendered in a browser at 412px and
 * 1440px and read off the live elements. The first attempt guessed a flat
 * 420/430px for everything and produced a CLS of 0.263 (Google's "poor" band
 * starts at 0.25): `topSelling` is a two-column grid of large cards and
 * actually stands 692px tall on a phone, so it lurched 342px the moment it
 * loaded.
 *
 * Two tiers only, switching at `md`. Widths between the two measured points
 * can still shift slightly; closing that would mean measuring every breakpoint
 * for a diminishing return.
 *
 * Re-measure these if a card's height, the grid columns, or the section
 * chrome changes.
 */
const RESERVED_HEIGHT: Record<LazySectionVariant, string> = {
  topSelling: "min-h-[692px] md:min-h-[793px]",
  featuredDeals: "min-h-[436px] md:min-h-[499px]",
  justForYou: "min-h-[364px] md:min-h-[498px]",
  collection: "min-h-[364px] md:min-h-[498px]",
};

/** Which component renders once the products land. */
export type LazySectionVariant =
  | "topSelling"
  | "justForYou"
  | "featuredDeals"
  | "collection";

/**
 * A homepage product row whose products are fetched when it nears the
 * viewport, not with the page.
 *
 * Product data was essentially the whole homepage payload — 464 KB of a 468 KB
 * response across six sections, none of them visible without scrolling. The
 * page now requests section shells (`withProducts=false`, 5 KB) and each row
 * pulls its own products from `/homepage-sections/:id/products` on approach.
 *
 * Two details that decide whether this reads as fast or as broken:
 *
 * `rootMargin` fires the observer well before the row is on screen, so the
 * fetch and render happen during the scroll rather than after it. Without it
 * the visitor watches an empty box fill in.
 *
 * `minHeight` reserves the space the loaded row will occupy. A placeholder
 * that collapses to nothing shoves everything below it down the instant
 * products arrive — that is layout shift, a quarter of the Lighthouse score,
 * and worse, it moves a tap target out from under someone's thumb.
 */
export function LazySectionProducts({
  sectionId,
  locale,
  variant,
  heading,
  viewAllHref,
  viewAllLabel,
}: {
  sectionId: number;
  locale: "EN" | "BN";
  variant: LazySectionVariant;
  heading?: string;
  viewAllHref?: string;
  viewAllLabel?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<ProductCardData[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let cancelled = false;
    const load = async () => {
      try {
        const data = await proxyFetch<{ products: (PublicProduct | null)[] }>(
          `/homepage-sections/${sectionId}/products?locale=${locale}`,
        );
        if (cancelled) return;
        setItems(
          (data.products ?? [])
            .filter((p): p is PublicProduct => p !== null)
            .map(toProductCardData)
            .filter((p) => !p.outOfStock),
        );
      } catch {
        if (!cancelled) setFailed(true);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        observer.disconnect();
        void load();
      },
      // 600px of warning: far enough that a normal scroll arrives to finished
      // content, close enough that someone who never scrolls never pays.
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [sectionId, locale]);

  // A failed fetch, or a section whose products are all out of stock, renders
  // nothing rather than an empty labelled box promising products that are not
  // coming.
  if (failed || (items && items.length === 0)) return null;

  if (!items) {
    return (
      <div
        ref={ref}
        className={RESERVED_HEIGHT[variant]}
        aria-busy="true"
        aria-label={heading ? `Loading ${heading}` : "Loading products"}
      />
    );
  }

  switch (variant) {
    case "topSelling":
      return <TopSellingProductsSectionClient heading={heading} items={items} />;
    case "justForYou":
      return (
        <TabbedCollectionCarouselSection
          title={heading ?? "Just For You"}
          viewAllHref={viewAllHref ?? "/products"}
          viewAllLabel={viewAllLabel ?? "Shop All"}
          items={items}
        />
      );
    case "featuredDeals":
      return (
        <FeaturedDealsSectionClient
          heading={heading ?? "Exclusive Deals"}
          viewAllHref={viewAllHref ?? "/products"}
          viewAllLabel={viewAllLabel ?? "View All"}
          items={items}
        />
      );
    case "collection":
      return (
        <ProductCarouselSectionClient
          heading={heading ?? ""}
          products={items}
          viewAllHref={viewAllHref ?? "/products"}
          viewAllLabel={viewAllLabel ?? "View All"}
          visibleCount={5}
          autoplayMs={4000}
        />
      );
  }
}
