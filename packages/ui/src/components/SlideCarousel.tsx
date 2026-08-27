"use client";

import { Children, useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * A carousel that scrolls ONE ITEM at a time.
 *
 * N items are visible at once (5 products at xl, fewer as the viewport
 * narrows) and the window walks along the row: 1-5, then 2-6, then 3-7. It
 * used to jump a whole container-width per step, so a ten-product row was two
 * static screens; now every product takes a turn at every position.
 *
 * Autoplay PING-PONGS. Stepping one item at a time, wrapping from the last
 * window back to the first is a jarring full-width jump, so it walks to the
 * end and then walks back — 1..10 then 10..1, continuously.
 *
 * N is *measured*, not configured. The caller controls how many fit purely
 * through `slotClassName` (a responsive flex-basis), and this component
 * divides the track width by a slot width to learn the count. Passing N in
 * as a prop as well would be two sources of truth for one number, and they
 * would drift the first time a breakpoint changed.
 *
 * Offsets stay in PERCENT rather than pixels: each slot's basis is exactly
 * 1/N of the track, so one step is 100/N per cent at every breakpoint, with no
 * arithmetic to keep in sync with the CSS.
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
  const rootRef = useRef<HTMLDivElement>(null);
  // `index` is the FIRST VISIBLE ITEM, not a page number: the track advances
  // one product at a time, so with five on screen the window walks
  // 1-5, 2-6, 3-7 ... rather than jumping 1-5, 6-10.
  const [index, setIndex] = useState(0);
  const [perSlide, setPerSlide] = useState(1);
  const [paused, setPaused] = useState(false);
  const [onScreen, setOnScreen] = useState(false);
  // +1 walking towards the end, -1 walking back. Autoplay ping-pongs rather
  // than wrapping: stepping one item at a time, a wrap from the last window
  // straight back to the first is a jarring full-width jump, where reversing
  // reads as one continuous motion.
  const direction = useRef(1);

  // Measured after mount and on every resize. Before that, perSlide stays 1
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
      const next = Math.max(1, Math.round(el.clientWidth / slot.offsetWidth));
      setPerSlide(next);
      // A resize that fits more per slide shrinks the last valid index, and
      // staying past it would strand the track on blank space.
      setIndex((i) => Math.min(i, Math.max(0, items.length - next)));
    }

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(track);
    return () => ro.disconnect();
  }, [items.length]);

  /**
   * The last index that still fills the row.
   *
   * Ten items five-at-a-time stop at 5 (showing items 6-10). Going further
   * would scroll blank space in from the right, which is what a plain
   * modulo would do.
   */
  const maxIndex = Math.max(0, items.length - perSlide);

  /** Manual arrows clamp; they do not wrap, so the ends stay reachable. */
  const go = useCallback(
    (delta: number) =>
      setIndex((i) => Math.min(maxIndex, Math.max(0, i + delta))),
    [maxIndex],
  );

  /** Autoplay step: reverse at either end instead of wrapping. */
  const advance = useCallback(() => {
    setIndex((i) => {
      if (maxIndex === 0) return 0;
      if (i + direction.current > maxIndex) direction.current = -1;
      else if (i + direction.current < 0) direction.current = 1;
      return i + direction.current;
    });
  }, [maxIndex]);

  /**
   * Autoplay only while the carousel is actually on screen.
   *
   * The homepage stacks five of these down a ~9000px page. Every one of them
   * used to keep its timer running and keep animating a 700ms transform on a
   * track holding up to eleven product cards -- four of them for a reader who
   * could only ever see one. That is pure compositor work on a phone, and it
   * never stops for as long as the tab is open.
   *
   * Advancing a carousel nobody is looking at is also just wrong on its own
   * terms: scroll down and you arrive mid-rotation at whatever slide the
   * timer happened to reach, having silently skipped the first ones.
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const io = new IntersectionObserver(
      ([entry]) => setOnScreen(entry.isIntersecting),
      // A small margin so it is already moving by the time it scrolls in,
      // rather than visibly starting from a standstill.
      { rootMargin: "200px" },
    );
    io.observe(root);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!autoplayMs || maxIndex === 0 || paused || !onScreen) return;
    const timer = setInterval(advance, autoplayMs);
    return () => clearInterval(timer);
  }, [autoplayMs, maxIndex, paused, onScreen, advance]);

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
      ref={rootRef}
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
          // One slot is 100/perSlide of the TRACK width (its flex-basis is
          // exactly that fraction), so shifting by index * that percentage
          // moves precisely one product per step at every breakpoint, with no
          // pixel arithmetic to keep in sync with the CSS.
          style={{ transform: `translateX(-${(index * 100) / perSlide}%)` }}
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

      {/* Arrows are absolutely positioned, so they can appear after measuring
          without moving anything. */}
      {maxIndex > 0 && (
        <>
          {arrow("prev")}
          {arrow("next")}
        </>
      )}

      {/* The dots ROW is always rendered, even while empty, and its height is
          fixed. It used to live behind the same `pageCount > 1` guard as the
          arrows — but pageCount is 1 until the effect measures the track, so
          the server sent no row at all and hydration then inserted 28px into
          every carousel at once. Everything below jumped down: one 0.33 CLS
          hit on the homepage (five carousels), which reads as the page
          "lurching" rather than as anything being slow. Reserving the space
          costs an empty 28px strip under a carousel that only has one page,
          which is the cheap side of that trade. */}
      <div className="mt-5 flex h-2 justify-center gap-2">
        {/* One dot per RESTING POSITION now that the track steps by a single
            product — ten items five-at-a-time gives six, not two. Dots per
            "page" would be lying about where the track can stop. */}
        {maxIndex > 0 &&
          Array.from({ length: maxIndex + 1 }, (_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Show products ${i + 1} to ${i + perSlide}`}
              aria-current={i === index}
              onClick={() => {
                // Jumping backwards should leave autoplay heading forwards
                // again, otherwise it immediately walks back off the position
                // the reader just chose.
                direction.current = i < index ? 1 : -1;
                setIndex(i);
              }}
              className={`h-2 rounded-full transition-all ${
                i === index ? "w-5 bg-header-green" : "w-2 bg-header-green/30"
              }`}
            />
          ))}
      </div>
    </div>
  );
}
