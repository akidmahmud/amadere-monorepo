"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { formatMoney } from "./PriceTag";

export interface ProductStripItem {
  href: string;
  productId: number;
  name: string;
  imageUrl?: string;
  /** Decimal string from the backend. */
  price: string;
  /** Decimal string — present only when the product is on sale. */
  originalPrice?: string;
  /** Drives the "Best Selling" badge — Product.isFeatured, an existing
   * admin-editable flag that had no storefront consumer until this section. */
  isFeatured?: boolean;
  /** Variant products: the variant id Add to Cart must send — without it
   * the backend rejects the request ("requires a variantId"). No inline
   * picker here (matches the reference design), so this is always the
   * product's own default variant. */
  defaultPackValue?: string;
}

export interface ProductStripSectionProps {
  title: string;
  viewAllHref: string;
  viewAllLabel?: string;
  items: ProductStripItem[];
  onAddToCart?: (productId: number, packValue?: string) => void;
  addToCartPendingId?: number;
  addToCartLabel?: string;
  bestBadgeLabel?: string;
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
const cartIcon = (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="8" cy="21" r="1" />
    <circle cx="19" cy="21" r="1" />
    <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
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
  bestBadgeLabel = "Best Selling",
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

  if (items.length === 0) return null;

  return (
    <section className="pt-10 md:pt-14">
      <div className="mx-auto max-w-[1440px] px-4 md:px-6">
        <div className="mb-6 flex items-end justify-between gap-4 border-b border-header-line pb-3.5">
          <h2 className="relative font-header text-[1.35rem] font-extrabold text-header-ink after:absolute after:-bottom-[15px] after:left-0 after:h-[3.5px] after:w-11 after:rounded-[3px] after:bg-gold after:content-['']">
            {title}
          </h2>
          <Link
            href={viewAllHref}
            className="inline-flex shrink-0 items-center gap-1.5 font-header text-[0.8rem] font-extrabold uppercase tracking-[0.04em] text-header-green hover:text-header-green-dark hover:underline"
          >
            {viewAllLabel}
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
            {items.map((item) => {
              const hasDiscount = item.originalPrice != null && Number(item.originalPrice) > Number(item.price);
              const savePercent = hasDiscount ? Math.round((1 - Number(item.price) / Number(item.originalPrice)) * 100) : 0;
              const isPending = addToCartPendingId === item.productId;
              return (
                <article
                  key={item.productId}
                  className="relative flex min-w-[170px] flex-none basis-[calc((100%-20px)/2)] snap-start flex-col rounded-xl border border-header-line bg-white p-3.5 pb-4 transition-[box-shadow,border-color] duration-200 hover:border-header-green hover:shadow-[0_10px_24px_rgba(33,113,61,.13)] sm:basis-[calc((100%-40px)/3)] lg:basis-[calc((100%-60px)/4)] xl:basis-[calc((100%-80px)/5)]"
                >
                  {item.isFeatured ? (
                    <span className="absolute left-3 top-3 z-[2] rounded-md bg-gold px-2.5 py-1.5 text-[0.66rem] font-extrabold text-[#3d3410]">
                      {bestBadgeLabel}
                    </span>
                  ) : hasDiscount ? (
                    <span className="absolute right-3 top-3 z-[2] rounded-md bg-header-green px-2.5 py-1.5 text-[0.66rem] font-extrabold text-white">
                      Save {savePercent}%
                    </span>
                  ) : null}

                  <Link href={item.href} className="mb-3.5 flex h-40 items-center justify-center overflow-hidden md:h-[210px]">
                    {item.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.imageUrl} alt="" className="max-h-full max-w-full object-contain transition-transform duration-300 hover:scale-105" />
                    ) : (
                      <div className="h-full w-full bg-beige" />
                    )}
                  </Link>

                  <h3 className="min-h-[2.6em] font-header text-[0.92rem] font-bold leading-[1.4] text-header-ink">
                    <Link href={item.href} className="hover:text-header-green">
                      {item.name}
                    </Link>
                  </h3>

                  <div className="my-2 mb-3.5 flex items-center gap-2.5">
                    <span className="font-header text-base font-extrabold text-header-green">{formatMoney(item.price)}</span>
                    {hasDiscount && (
                      <span className="font-header text-[0.82rem] font-semibold text-header-muted line-through">
                        {formatMoney(item.originalPrice!)}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => onAddToCart?.(item.productId, item.defaultPackValue)}
                    className={cn(
                      "mt-auto flex h-[42px] w-full items-center justify-center gap-2 rounded-lg border-[1.5px] border-header-green bg-white font-header text-[0.82rem] font-bold text-header-green transition-colors hover:bg-header-green hover:text-white",
                      isPending && "opacity-60",
                    )}
                  >
                    {cartIcon}
                    {isPending ? "…" : addToCartLabel}
                  </button>
                </article>
              );
            })}
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
