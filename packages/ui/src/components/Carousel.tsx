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
}

const chevronLeft = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-[22px] w-[22px]">
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const chevronRight = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-[22px] w-[22px]">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export function Carousel({ children, className, autoplayMs, centerWhenFits = true }: CarouselProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  // Distinct from canScrollLeft/Right (which track *current* scroll position)
  // — this is a fixed property of content-vs-container width, used to decide
  // whether the row should be centered (fits fully, nothing to scroll to) or
  // left-aligned (overflows, so centering would clip the start — same bug
  // class as the site nav's justify-center fix).
  const [hasOverflow, setHasOverflow] = useState(false);

  function updateScrollState() {
    const row = rowRef.current;
    if (!row) return;
    setCanScrollLeft(row.scrollLeft > 4);
    setCanScrollRight(row.scrollLeft + row.clientWidth < row.scrollWidth - 4);
    setHasOverflow(row.scrollWidth > row.clientWidth + 4);
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

  useEffect(() => {
    if (!autoplayMs || !hasOverflow) return;
    const timer = setInterval(() => {
      const row = rowRef.current;
      if (!row) return;
      const atEnd = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
      if (atEnd) {
        row.scrollTo({ left: 0, behavior: "smooth" });
      } else {
        scroll(1);
      }
    }, autoplayMs);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplayMs, hasOverflow]);

  return (
    <div className={cn("relative px-1", className)}>
      {canScrollLeft && (
        <button
          type="button"
          aria-label="Scroll left"
          onClick={() => scroll(-1)}
          className="absolute left-[-6px] top-[30%] z-[6] grid h-[46px] w-[46px] -translate-y-1/2 place-items-center rounded-[10px] bg-gold text-white shadow-brand hover:bg-gold-dark"
        >
          {chevronLeft}
        </button>
      )}
      <div
        ref={rowRef}
        onScroll={updateScrollState}
        className={cn(
          "flex gap-4.5 overflow-x-auto scroll-smooth px-0.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          !hasOverflow && centerWhenFits && "justify-center",
        )}
      >
        {children}
      </div>
      {canScrollRight && (
        <button
          type="button"
          aria-label="Scroll right"
          onClick={() => scroll(1)}
          className="absolute right-[-6px] top-[30%] z-[6] grid h-[46px] w-[46px] -translate-y-1/2 place-items-center rounded-[10px] bg-gold text-white shadow-brand hover:bg-gold-dark"
        >
          {chevronRight}
        </button>
      )}
    </div>
  );
}
