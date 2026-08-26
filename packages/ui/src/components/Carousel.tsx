"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export interface CarouselProps {
  children: ReactNode;
  className?: string;
  /** Auto-advance one "page" every N ms, looping back to the start at the end. Off by default. */
  autoplayMs?: number;
  /** Center the row when its content doesn't fill the width. Default true (matches product-collection carousels); set false to always left-align, e.g. next to a fixed-position promo tile. */
  centerWhenFits?: boolean;
  /** Show the left/right scroll-arrow buttons. Default true; set false for a swipe-only carousel with no visible arrows. */
  showArrows?: boolean;
  /** Shrink the arrow buttons on mobile (36px instead of 46px) — for
   * carousels whose cards are narrow enough that the default 46px arrows
   * look oversized there. Unchanged from md up either way. */
  compactArrowsOnMobile?: boolean;
  /** Show a row of "page" dots below the track (pixel-matched to
   * ghorerbazar.com's combo-deals swiper pagination) — approximate, not a
   * per-slide-group index like Swiper's: pages are computed from viewport
   * widths (scrollWidth / clientWidth), which is exact when every card is
   * the same width and close enough otherwise. Off by default. */
  showDots?: boolean;
}

function chevronLeft(compact: boolean) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className={compact ? "h-4 w-4 md:h-[22px] md:w-[22px]" : "h-[22px] w-[22px]"}>
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}
function chevronRight(compact: boolean) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className={compact ? "h-4 w-4 md:h-[22px] md:w-[22px]" : "h-[22px] w-[22px]"}>
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

export function Carousel({
  children,
  className,
  autoplayMs,
  centerWhenFits = true,
  showArrows = true,
  compactArrowsOnMobile = false,
  showDots = false,
}: CarouselProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  // Distinct from canScrollLeft/Right (which track *current* scroll position)
  // — this is a fixed property of content-vs-container width, used to decide
  // whether the row should be centered (fits fully, nothing to scroll to) or
  // left-aligned (overflows, so centering would clip the start — same bug
  // class as the site nav's justify-center fix).
  const [hasOverflow, setHasOverflow] = useState(false);
  const [pageCount, setPageCount] = useState(1);
  const [currentPage, setCurrentPage] = useState(0);
  // Paused while any interactive element inside a card (e.g. ProductCardTwo's
  // pack-size <select>) has focus — React 17+ delegates onFocus/onBlur via
  // the bubbling focusin/focusout events, so this catches focus anywhere in
  // the row without each card needing to know about the carousel. Per
  // explicit request: picking a variant shouldn't have the slide advance out
  // from under the shopper mid-selection.
  const [paused, setPaused] = useState(false);

  function updateScrollState() {
    const row = rowRef.current;
    if (!row) return;
    setCanScrollLeft(row.scrollLeft > 4);
    setCanScrollRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
    setHasOverflow(row.scrollWidth > row.clientWidth + 4);
    if (showDots && row.clientWidth > 0) {
      setPageCount(Math.max(1, Math.round(row.scrollWidth / row.clientWidth)));
      setCurrentPage(Math.round(row.scrollLeft / row.clientWidth));
    }
  }

  function goToPage(page: number) {
    const row = rowRef.current;
    if (!row) return;
    row.scrollTo({ left: page * row.clientWidth, behavior: "smooth" });
  }

  useEffect(() => {
    updateScrollState();
    const row = rowRef.current;
    if (!row) return;
    const observer = new ResizeObserver(updateScrollState);
    observer.observe(row);
    return () => observer.disconnect();
  }, [children]);

  function scroll(direction: -1 | 1) {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({ left: direction * row.clientWidth * 0.9, behavior: "smooth" });
  }

  const autoplayDir = useRef<1 | -1>(1);

  useEffect(() => {
    if (!autoplayMs || !hasOverflow || paused) return;
    const timer = setInterval(() => {
      const row = rowRef.current;
      if (!row) return;
      const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
      const atStart = row.scrollLeft <= 4;
      if (atEnd) {
        autoplayDir.current = -1;
      } else if (atStart) {
        autoplayDir.current = 1;
      }
      scroll(autoplayDir.current);
    }, autoplayMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplayMs, hasOverflow, paused]);

  return (
    <div className={cn("relative px-1", className)}>
      {showArrows && canScrollLeft && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scroll(-1)}
          className={cn(
            "absolute left-[-6px] top-[30%] z-[6] -translate-y-1/2 grid place-items-center bg-green text-white shadow-brand hover:bg-green-dark",
            compactArrowsOnMobile ? "h-9 w-9 rounded-lg md:h-[46px] md:w-[46px] md:rounded-[10px]" : "h-[46px] w-[46px] rounded-[10px]",
          )}
        >
          {chevronLeft(compactArrowsOnMobile)}
        </button>
      )}
      <div
        ref={rowRef}
        onScroll={updateScrollState}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        className={cn(
          "flex snap-x snap-mandatory gap-4.5 overflow-x-auto scroll-smooth px-0.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          !hasOverflow && centerWhenFits && "justify-center",
        )}
      >
        {children}
      </div>
      {showArrows && canScrollRight && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scroll(1)}
          className={cn(
            "absolute right-[-6px] top-[30%] z-[6] -translate-y-1/2 grid place-items-center bg-green text-white shadow-brand hover:bg-green-dark",
            compactArrowsOnMobile ? "h-9 w-9 rounded-lg md:h-[46px] md:w-[46px] md:rounded-[10px]" : "h-[46px] w-[46px] rounded-[10px]",
          )}
        >
          {chevronRight(compactArrowsOnMobile)}
        </button>
      )}
      {showDots && hasOverflow && pageCount > 1 && (
        <div className="mt-3 flex justify-center gap-2">
          {Array.from({ length: pageCount }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to page ${i + 1}`}
              onClick={() => goToPage(i)}
              className={cn(
                "h-2 rounded-full transition-[width,background-color] duration-200",
                i === currentPage ? "w-5 bg-header-green" : "w-2 bg-line",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
