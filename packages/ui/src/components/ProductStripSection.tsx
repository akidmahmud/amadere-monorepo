"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import type { PackPickerOption } from "./PackPickerModal";
import { SiteProductCard } from "./SiteProductCard";

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

const prevIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const nextIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
const viewAllIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

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
  const trackRef = useRef<HTMLDivElement>(null);
  const [pageCount, setPageCount] = useState(1);
  const [activePage, setActivePage] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    function recompute() {
      if (!track) return;
      // ceil, not round: any real overflow (even 1.2 "pages" worth) must stay
      // reachable via the arrows/dots — the track's native scrollbar is
      // hidden, so rounding down to 1 page would strand real content with
      // no way to reach it (confirmed live: a 6th card cut off at 1440px,
      // 5 cards per row, silently unreachable until this was ceil'd).
      setPageCount(Math.max(1, Math.ceil(track.scrollWidth / track.clientWidth)));
    }
    recompute();
    const observer = new ResizeObserver(recompute);
    observer.observe(track);
    return () => observer.disconnect();
  }, [items.length]);

  function handleScroll() {
    const track = trackRef.current;
    if (!track) return;
    setActivePage(Math.round(track.scrollLeft / track.clientWidth));
  }

  function goToPage(page: number) {
    const track = trackRef.current;
    if (!track) return;
    track.scrollTo({ left: page * track.clientWidth, behavior: "smooth" });
  }

  function scrollByPage(delta: number) {
    trackRef.current?.scrollBy({ left: delta * (trackRef.current?.clientWidth ?? 0), behavior: "smooth" });
  }

  // Auto-advances one page every 4.5s once there's more than one page,
  // looping back to the start at the end — reads scrollLeft directly rather
  // than the activePage state, so this doesn't need to re-subscribe on every
  // page change.
  useEffect(() => {
    if (pageCount <= 1) return;
    const timer = setInterval(() => {
      const track = trackRef.current;
      if (!track) return;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      if (atEnd) track.scrollTo({ left: 0, behavior: "smooth" });
      else scrollByPage(1);
    }, 4500);
    return () => clearInterval(timer);
  }, [pageCount]);

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

        <div className="relative">
          {pageCount > 1 && (
            <button
              type="button"
              aria-label="Scroll left"
              onClick={() => scrollByPage(-1)}
              className="absolute -left-[14px] top-[150px] z-[5] hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-header-line bg-white text-header-green shadow-[0_4px_12px_rgba(30,43,34,.14)] transition-colors hover:bg-header-green hover:text-white md:grid"
            >
              {prevIcon}
            </button>
          )}

          <div
            ref={trackRef}
            onScroll={handleScroll}
            className="flex snap-x snap-mandatory gap-5 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item) => (
              <div
                key={item.productId}
                className="min-w-[150px] flex-none basis-[calc((100%-12px)/2)] snap-start sm:basis-[calc((100%-40px)/3)] lg:basis-[calc((100%-60px)/4)] xl:basis-[calc((100%-80px)/5)]"
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
          </div>

          {pageCount > 1 && (
            <button
              type="button"
              aria-label="Scroll right"
              onClick={() => scrollByPage(1)}
              className="absolute -right-[14px] top-[150px] z-[5] hidden h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-header-line bg-white text-header-green shadow-[0_4px_12px_rgba(30,43,34,.14)] transition-colors hover:bg-header-green hover:text-white md:grid"
            >
              {nextIcon}
            </button>
          )}
        </div>

        {pageCount > 1 && (
          <div className="mt-5 flex justify-center gap-2">
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to page ${i + 1}`}
                onClick={() => goToPage(i)}
                className={cn(
                  "h-2 rounded-full bg-[#d8cbb4] transition-[width,background-color] duration-200",
                  i === activePage ? "w-5 rounded-[5px] bg-header-green" : "w-2",
                )}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
