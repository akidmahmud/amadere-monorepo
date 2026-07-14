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
  viewAllLabel?: string;
  addToCartLabel?: string;
  addToCartPendingHref?: string;
  onAddToCart?: (href: string, packValue?: string) => void;
  linkComponent?: LinkComponent;
}

// "Shop by Category / Shop by Concern" tabbed product carousel — each tab is
// a real Collection (see FEATURE_tabbed-collection-carousel.md). All tabs'
// data arrives in the initial homepage payload (server-resolved), so
// switching tabs here is instant client-side state, no re-fetch.
export function TabbedCollectionCarousel({
  heading,
  tabs,
  defaultActiveIndex = 0,
  viewAllLabel = "View All",
  addToCartLabel,
  addToCartPendingHref,
  onAddToCart,
  linkComponent,
}: TabbedCollectionCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(
    Math.min(Math.max(defaultActiveIndex, 0), Math.max(tabs.length - 1, 0)),
  );

  if (tabs.length === 0) return null;
  const active = tabs[activeIndex];

  return (
    <div className="py-9">
      {heading && <SectionHeading>{heading}</SectionHeading>}
      <CollectionTabs
        options={tabs.map((t, i) => ({ key: String(i), label: t.label }))}
        activeKey={String(activeIndex)}
        onChange={(key) => setActiveIndex(Number(key))}
        className="mb-6"
      />
      <div className="grid grid-cols-[320px_1fr] gap-6 max-lg:grid-cols-1">
        <PromoTile
          imageUrl={active.promoImageUrl}
          heading={active.promoHeading}
          blurb={active.promoBlurb}
          viewAllHref={active.viewAllHref}
          viewAllLabel={viewAllLabel}
          linkComponent={linkComponent}
        />
        {active.products.length > 0 ? (
          <Carousel centerWhenFits={false}>
            {active.products.map((product) => (
              <div key={product.href} className="w-[200px] shrink-0">
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
        ) : (
          <div className="grid min-h-[200px] place-items-center rounded-2xl bg-beige font-body text-sm text-muted">
            No products in this collection yet.
          </div>
        )}
      </div>
    </div>
  );
}
