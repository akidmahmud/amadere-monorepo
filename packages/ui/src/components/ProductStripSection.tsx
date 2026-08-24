"use client";

import { InfiniteMarquee } from "./InfiniteMarquee";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import type { PackPickerOption } from "./PackPickerModal";
import { SiteProductCard } from "./SiteProductCard";

const viewAllIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

export interface ProductStripItem {
  href: string;
  productId: number;
  name: string;
  imageUrl?: string;
  /** Decimal string from the backend. */
  price: string;
  /** Decimal string — present only when the product is on sale. */
  originalPrice?: string;
  /** Corner "flag" badge text (e.g. "Best Selling") — Product.flagLabel, or a
   * per-placement curated override depending on the caller. */
  flagLabel?: string;
  /** Variant products with more than one pack: Add to Cart opens a
   * PackPickerModal to choose first. A single pack (or none) still adds
   * directly via defaultPackValue below — nothing to pick. */
  packOptions?: PackPickerOption[];
  /** The variant id Add to Cart sends when there's no pack choice to make —
   * without it the backend rejects the request ("requires a variantId"). */
  defaultPackValue?: string;
  /** Simple (non-variant) products only — variant stock lives per-pack on
   * packOptions[].outOfStock instead. */
  outOfStock?: boolean;
}

export interface ProductStripSectionProps {
  title: string;
  viewAllHref: string;
  viewAllLabel?: string;
  items: ProductStripItem[];
  onAddToCart?: (productId: number, packValue?: string) => void;
  addToCartPendingId?: number;
  addToCartLabel?: string;
  linkComponent?: LinkComponent;
}

// Pixel-matched to amader-home-top.html's "Amader Modhu — Natural Honey"
// category product strip — used by TABBED_COLLECTION_CAROUSEL, which is no
// longer tabbed (dropped the pill-switcher + promo tile; one collection per
// section now, matching this reference exactly). The reference's own
// strip-arrow/strip-dots markup has no JS behind it in that file (unwired
// placeholders) — the scroll-by-page/dot-tracking behavior here is a real,
// working implementation, not a transcription of reference behavior that
// doesn't exist.
export function ProductStripSection({
  title,
  viewAllHref,
  viewAllLabel = "View All Items",
  items,
  onAddToCart,
  addToCartPendingId,
  addToCartLabel = "Add To Cart",
  linkComponent: Link = DefaultLink,
}: ProductStripSectionProps) {
  if (items.length === 0) return null;

  return (
    <section className="pt-10 md:pt-14">
      <div className="mx-auto max-w-[1440px] px-[2px] md:px-[3px]">
        <div className="mb-6 flex items-end justify-between gap-4 border-b border-header-line pb-3.5">
          <h2 className="relative ml-1 min-w-0 whitespace-nowrap font-serif text-[14px] font-semibold text-green after:absolute after:-bottom-[15px] after:left-0 after:h-[3.5px] after:w-11 after:rounded-[3px] after:bg-gold after:content-[''] sm:ml-0 sm:text-[22px] md:text-[30px]">
            {title}
          </h2>
          <Link
            href={viewAllHref}
            className="inline-flex shrink-0 items-center gap-1.5 font-header text-[0.8rem] font-extrabold uppercase tracking-[0.04em] text-header-green hover:text-header-green-dark"
          >
            <span className="underline">{viewAllLabel}</span>
            {viewAllIcon}
          </Link>
        </div>

        {/* Continuous loop rather than the previous page-and-rewind
            carousel, which visibly jumped back to the first card. Arrows and
            page dots are gone with it — they need a fixed page model, which
            an always-moving track does not have, and hovering pauses the row
            so a card can still be read and clicked.

            Card widths are fixed rather than the old
            `basis-[calc((100%-Npx)/N)]`: percentage bases resolve against the
            track, and a marquee track is `w-max`, so they would collapse.
            Fitting exactly N per row does not matter here either — that
            constraint only existed to make snap-paging land cleanly. */}
        <InfiniteMarquee secondsPerItem={10} gapPx={20} ariaLabel={title}>
          {items.map((item) => (
            <div
              key={item.productId}
              className="w-[150px] sm:w-[200px] md:w-[230px] xl:w-[260px]"
            >
              <SiteProductCard
                href={item.href}
                name={item.name}
                imageUrl={item.imageUrl}
                price={item.price}
                originalPrice={item.originalPrice}
                flagLabel={item.flagLabel}
                packOptions={item.packOptions}
                defaultPackValue={item.defaultPackValue}
                outOfStock={item.outOfStock}
                addToCartLabel={addToCartLabel}
                addToCartPending={addToCartPendingId === item.productId}
                onAddToCart={(packValue) => onAddToCart?.(item.productId, packValue)}
                linkComponent={Link}
              />
            </div>
          ))}
        </InfiniteMarquee>
      </div>
    </section>
  );
}
