"use client";

import type { LinkComponent } from "../lib/link-component";
import { DefaultLink } from "../lib/link-component";
import { Carousel } from "./Carousel";
import type { ProductCardProps } from "./ProductCard";
import { SiteProductCard } from "./SiteProductCard";

export type FeaturedDealsItem = Pick<
  ProductCardProps,
  "href" | "name" | "imageUrl" | "price" | "originalPrice" | "discountLabel" | "flagLabel" | "saleEndsAt" | "packOptions" | "defaultPackValue" | "outOfStock"
>;

export interface FeaturedDealsSectionProps {
  heading?: string;
  viewAllHref: string;
  viewAllLabel?: string;
  items: FeaturedDealsItem[];
  onAddToCart?: (href: string, packValue?: string) => void;
  addToCartPendingHref?: string;
  linkComponent?: LinkComponent;
}

const giftIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="8" width="18" height="4" />
    <path d="M12 8v13M3 12v7a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-7" />
    <path d="M12 8H7.5a2.5 2.5 0 0 1 0-5C11 3 12 8 12 8ZM12 8h4.5a2.5 2.5 0 0 0 0-5C13 3 12 8 12 8Z" />
  </svg>
);

// The old "Exclusive Combo Deals" visual (gradient card, gift-icon heading,
// filled "View All" button, product carousel) — kept exactly, but the items
// are now plain admin-picked products (config.items, same shape as
// TOP_SELLING_PRODUCTS/JUST_FOR_YOU) instead of a ProductBundle entity, so
// there's no bundle pricing/combo logic behind it anymore.
export function FeaturedDealsSection({
  heading = "Exclusive Deals",
  viewAllHref,
  viewAllLabel = "View All",
  items,
  onAddToCart,
  addToCartPendingHref,
  linkComponent: Link = DefaultLink,
}: FeaturedDealsSectionProps) {
  if (items.length === 0) return null;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-green/10 to-cream p-4 md:p-8">
      <div className="mb-5 flex items-center justify-between gap-4 md:mb-6">
        <div className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-header-green text-white">
            {giftIcon}
          </span>
          <h2 className="font-serif text-[22px] font-semibold text-green md:text-[30px]">{heading}</h2>
        </div>
        <Link
          href={viewAllHref}
          className="inline-flex shrink-0 items-center gap-1.5 rounded bg-header-green px-3 py-2 font-header text-xs font-semibold text-white transition-colors hover:bg-header-green-dark"
        >
          {viewAllLabel} →
        </Link>
      </div>

      <Carousel showDots>
        {items.map((item) => (
          <div key={item.href} className="w-[calc((100%-18px)/2)] shrink-0 md:w-[200px]">
            <SiteProductCard
              {...item}
              addToCartPending={addToCartPendingHref === item.href}
              onAddToCart={(packValue) => onAddToCart?.(item.href, packValue)}
              linkComponent={Link}
            />
          </div>
        ))}
      </Carousel>
    </div>
  );
}
