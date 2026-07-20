"use client";

import { useState } from "react";
import type { LinkComponent } from "../lib/link-component";
import { Carousel } from "./Carousel";
import { CollectionTabs } from "./CollectionTabs";
import { PromoTile } from "./PromoTile";
import { ProductCard, type ProductCardProps } from "./ProductCard";
import { SectionHeading } from "./SectionHeading";

export type TabbedCollectionCarouselProduct = Pick<
  ProductCardProps,
  "href" | "name" | "imageUrl" | "price" | "originalPrice" | "discountLabel" | "packOptions" | "defaultPackValue"
>;

export interface TabbedCollectionCarouselTab {
  key: string;
  label: string;
  promoImageUrl?: string;
  promoHeading: string;
  promoBlurb?: string;
  viewAllHref: string;
  products: TabbedCollectionCarouselProduct[];
}

export interface TabbedCollectionCarouselProps {
  heading?: string;
  tabs: TabbedCollectionCarouselTab[];
  defaultActiveIndex?: number;
  addToCartLabel?: string;
  addToCartPendingHref?: string;
  onAddToCart?: (href: string, packValue?: string) => void;
  linkComponent?: LinkComponent;
  /** How many tiles (promo tile + product cards) fit per view — same
   * responsive sizing ProductCarouselSection uses for the homepage's other
   * product carousels, so this row's cards render at the same normal size
   * instead of the smaller fixed-200px default. */
  visibleCount?: number;
}

const CARD_GAP_PX = 18; // matches Carousel's `gap-4.5`

// "Shop by Category / Shop by Concern" tabbed product carousel — each tab is
// a real Collection (see FEATURE_tabbed-collection-carousel.md). All tabs'
// data arrives in the initial homepage payload (server-resolved), so
// switching tabs here is instant client-side state, no re-fetch.
export function TabbedCollectionCarousel({
  heading,
  tabs,
  defaultActiveIndex = 0,
  addToCartLabel,
  addToCartPendingHref,
  onAddToCart,
  linkComponent,
  visibleCount = 5,
}: TabbedCollectionCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(
    Math.min(Math.max(defaultActiveIndex, 0), Math.max(tabs.length - 1, 0)),
  );

  if (tabs.length === 0) return null;
  const active = tabs[activeIndex];
  const cardWidthExpr = `(100% - ${(visibleCount - 1) * CARD_GAP_PX}px) / ${visibleCount}`;
  // Mobile always shows 2 cards per row — see ProductCarouselSection's
  // matching comment for why the desktop width goes through a CSS custom
  // property instead of an interpolated Tailwind arbitrary-value class.
  const desktopWidthStyle = { "--desktop-card-width": `calc(${cardWidthExpr})` } as React.CSSProperties;

  return (
    <div className="py-9">
      {heading && <SectionHeading>{heading}</SectionHeading>}
      <CollectionTabs
        options={tabs.map((t, i) => ({ key: String(i), label: t.label }))}
        activeKey={String(activeIndex)}
        onChange={(key) => setActiveIndex(Number(key))}
        className="mb-6"
      />
      <Carousel centerWhenFits={false}>
        {/* Promo tile is desktop-only on mobile — not needed there. */}
        <div className="hidden min-w-0 shrink-0 sm:block sm:w-[var(--desktop-card-width)]" style={desktopWidthStyle}>
          <PromoTile imageUrl={active.promoImageUrl} />
        </div>
        {active.products.map((product) => (
          <div
            key={product.href}
            className="min-w-0 shrink-0 w-[calc((100%-18px)/2)] sm:w-[var(--desktop-card-width)]"
            style={desktopWidthStyle}
          >
            <ProductCard
              {...product}
              addToCartLabel={addToCartLabel}
              addToCartPending={addToCartPendingHref === product.href}
              onAddToCart={(packValue) => onAddToCart?.(product.href, packValue)}
              linkComponent={linkComponent}
            />
          </div>
        ))}
      </Carousel>
      {active.products.length === 0 && (
        <div className="mt-4 grid min-h-[200px] place-items-center rounded-2xl bg-beige font-body text-sm text-muted">
          No products in this collection yet.
        </div>
      )}
    </div>
  );
}
