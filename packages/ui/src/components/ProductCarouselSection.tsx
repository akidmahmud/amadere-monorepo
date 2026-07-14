"use client";

import { ReactNode } from "react";
import type { LinkComponent } from "../lib/link-component";
import { Carousel } from "./Carousel";
import { PillTabs, type PillTabOption } from "./PillTabs";
import { ProductCard, type ProductCardProps } from "./ProductCard";
import { SectionHeading, ViewAllLink } from "./SectionHeading";

export type ProductCarouselItem = Pick<
  ProductCardProps,
  "href" | "name" | "imageUrl" | "price" | "originalPrice" | "discountLabel" | "packOptions" | "defaultPackValue"
>;

export interface ProductCarouselSectionProps {
  heading: ReactNode;
  products: ProductCarouselItem[];
  viewAllHref?: string;
  viewAllLabel?: string;
  addToCartLabel?: string;
  onAddToCart?: (href: string, packValue?: string) => void;
  addToCartPendingHref?: string;
  pillOptions?: PillTabOption[];
  activePill?: string;
  onPillChange?: (value: string) => void;
  linkComponent?: LinkComponent;
  /** How many cards fit per view — sizes cards responsively instead of the default fixed 200px. */
  visibleCount?: number;
  /** Auto-advance the carousel every N ms once there are more products than fit in one view. */
  autoplayMs?: number;
}

const CARD_GAP_PX = 18; // matches Carousel's `gap-4.5`

export function ProductCarouselSection({
  heading,
  products,
  viewAllHref,
  viewAllLabel,
  addToCartLabel,
  onAddToCart,
  addToCartPendingHref,
  pillOptions,
  activePill,
  onPillChange,
  linkComponent,
  visibleCount,
  autoplayMs,
}: ProductCarouselSectionProps) {
  if (products.length === 0) return null;

  const cardStyle = visibleCount
    ? { width: `calc((100% - ${(visibleCount - 1) * CARD_GAP_PX}px) / ${visibleCount})` }
    : undefined;

  return (
    <section className="py-9">
      <SectionHeading>{heading}</SectionHeading>
      {pillOptions && activePill !== undefined && onPillChange && (
        <PillTabs options={pillOptions} value={activePill} onChange={onPillChange} />
      )}
      <Carousel autoplayMs={autoplayMs}>
        {products.map((product) => (
          <div
            key={product.href}
            className={visibleCount ? "min-w-0 shrink-0" : "w-[200px] shrink-0"}
            style={cardStyle}
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
      {viewAllHref && viewAllLabel && (
        <ViewAllLink href={viewAllHref} linkComponent={linkComponent}>
          {viewAllLabel}
        </ViewAllLink>
      )}
    </section>
  );
}
