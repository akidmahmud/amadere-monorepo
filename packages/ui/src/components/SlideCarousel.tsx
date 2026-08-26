"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A paged carousel: the track holds every item and moves exactly one
 * container-width at a time, so a "slide" is a fixed group of N items
 * (5 products at xl, fewer as the viewport narrows) rather than a free
 * scroll that can stop half way through a card.
 *
 * N is *measured*, not configured. The caller controls how many fit purely
 * through `slotClassName` (a responsive flex-basis), and this component
 * divides the track width by a slot width to learn the count. Passing N in
 * as a prop as well would be two sources of truth for one number, and they
 * would drift the first time a breakpoint changed.
 *
 * Moving by `translateX(-page * 100%)` rather than by a pixel offset is what
 * keeps the two in step: each slot's basis is a fraction of the track, so one
 * track-width is always exactly N slots wide at every breakpoint, with no
 * arithmetic that has to be kept in sync with the CSS.
 */
export function SlideCarousel({
  children,
  slotClassName,
  gapPx = 20,
  autoplayMs,
  ariaLabel,
}: {
  children: ReactNode;
  /** Responsive flex-basis deciding how many items make up one slide. */
  slotClassName: string;
  gapPx?: number;
  /** Omit to leave the carousel manual. */
  autoplayMs?: number;
  ariaLabel?: string;
}) {
  const items = Children.toArray(children);
  const trackRef = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [paused, setPaused] = useState(false);

  // Measured after mount and on every resize. Before that, pageCount stays 1
  // and the controls stay hidden — the server cannot know the viewport width,
  // and rendering a guessed number of dots would mean re-rendering different
  // markup on hydration.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function measure() {
      const el = trackRef.current;
      const slot = el?.firstElementChild as HTMLElement | null;
      if (!el || !slot || !slot.offsetWidth) return;
      // round, not floor: a slot basis of 1/3 lands on widths like 306.66px,
      // where floor would report 2 per slide instead of 3.
      const perSlide = Math.max(1, Math.round(el.clientWidth / slot.offsetWidth));
      const next = Math.max(1, Math.ceil(items.length / perSlide));
      setPageCount(next);
      // A resize that makes more fit per slide can leave the current page
      // past the new end, which would strand the track on blank space.
      setPage((p) => Math.min(p, next - 1));
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [items.length]);

  const go = useCallback(
    (delta: number) => setPage((p) => (p + delta + pageCount) % pageCount),
    [pageCount],
  );

  useEffect(() => {
    if (!autoplayMs || pageCount <= 1 || paused) return;
    const timer = setInterval(() => go(1), autoplayMs);
    return () => clearInterval(timer);
  }, [autoplayMs, pageCount, paused, go]);

  if (items.length === 0) return null;

  const arrow = (dir: "prev" | "next") => (
    <button
      type="button"
      aria-label={dir === "prev" ? "Previous slide" : "Next slide"}
      onClick={() => go(dir === "prev" ? -1 : 1)}
      className={[
        "absolute top-1/2 z-10 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full",
        "bg-white text-header-green shadow-[0_2px_10px_rgba(30,43,34,.18)]",
        "transition hover:bg-header-green hover:text-white active:scale-95",
        // Inset rather than straddling the edge: the sections that use this
        // have almost no horizontal padding (px-[2px]), so a half-overhanging
        // arrow gets clipped off-screen at the container's own boundary.
        dir === "prev" ? "left-2" : "right-2",
      ].join(" ")}
    >
      <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d={dir === "prev" ? "m15 19-7-7 7-7" : "m9 5 7 7-7 7"} />
      </svg>
    </button>
  );

  return (
    <div
      className="relative"
      aria-label={ariaLabel}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className="overflow-hidden">
        <div
          ref={trackRef}
          className="flex transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${page * 100}%)` }}
        >
          {items.map((child, i) => (
            // Gap as symmetric padding inside each slot, never a flex `gap`:
            // `gap` is added *between* items and so is not part of the basis
            // fraction, which would make one track-width slightly less than N
            // slots and let the pages drift out of alignment.
            // min-w-0 is load-bearing, not tidying: a flex item defaults to
            // `min-width: auto`, so a card whose content is wider than its
            // basis grows past it. One track-width would then hold fewer than
            // N slots and translateX(-page * 100%) would stop mid-card. With
            // min-w-0 the basis fraction is exact at every breakpoint.
            <div
              key={i}
              className={`min-w-0 shrink-0 ${slotClassName}`}
              style={{ paddingInline: gapPx / 2 }}
            >
              {child}
            </div>
          ))}
        </div>
      </div>

      {pageCount > 1 && (
        <>
          {arrow("prev")}
          {arrow("next")}
          <div className="mt-5 flex justify-center gap-2">
            {Array.from({ length: pageCount }, (_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === page}
                onClick={() => setPage(i)}
                className={`h-2 rounded-full transition-all ${
                  i === page ? "w-5 bg-header-green" : "w-2 bg-header-green/30"
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
