"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export interface MarketingReviewCardData {
  imageUrl: string;
  caption?: string | null;
}

export interface MarketingReviewSectionProps {
  cards: MarketingReviewCardData[];
  /** The wavy green background scene — full-bleed behind the whole section. */
  backgroundImageUrl: string;
  heading?: string;
}

const chevronLeft = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-[16px] w-[16px]">
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const chevronRight = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-[16px] w-[16px]">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export function MarketingReviewSection({ cards, backgroundImageUrl, heading }: MarketingReviewSectionProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  // Only center the row when its cards don't overflow — centering an
  // overflowing scrollable row clips its start off-screen with no way to
  // scroll back to it (same bug class Carousel.tsx's centerWhenFits avoids).
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    function update() {
      if (row) setHasOverflow(row.scrollWidth > row.clientWidth + 4);
    }
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, [cards.length]);

  if (cards.length === 0) return null;

  function scroll(direction: -1 | 1) {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({ left: direction * row.clientWidth * 0.9, behavior: "smooth" });
  }

  return (
    // The background is a whole scene (wave curves sit at fixed positions
    // within the source image, not a tileable/stretchable texture) — a
    // content-driven height with plain bg-cover crops inconsistently
    // depending on how many cards/how much caption text there is, and can
    // clip a wave entirely (confirmed: fewer/shorter cards shrank the box
    // enough to cut the bottom wave off). Locking the section to a
    // width-proportional aspect ratio instead of a fixed pixel height keeps
    // the same safe crop window at any screen width; if content ever needs
    // more room than that ratio provides, the box still grows to fit it —
    // this is a floor, not a cap.
    //
    // --- Tunables, to find the sweet spot: ---
    // `aspect-[1536/900]`: the box's width:height ratio. LOWER the second
    //   number (e.g. 800) for a SHORTER box — but too low starts clipping
    //   the wave curves again (see the comment above); HIGHER (e.g. 1000)
    //   for a taller box with more green space around the cards.
    // `pt-6`: gap between the top wave and the card row. Raise/lower this
    //   directly — it's independent of the aspect ratio.
    // `pb-10` on the inner wrapper below: leftover space at the bottom,
    //   between the arrows and the bottom wave.
    <div
      className="flex aspect-[1536/900] flex-col bg-cover bg-center pt-1"
      style={{ backgroundImage: `url(${backgroundImageUrl})` }}
    >
      <div className="mx-auto w-full max-w-[1180px] px-5 pb-10">
        {heading && (
          <h2 className="mb-8 text-center font-serif text-2xl font-semibold text-white">{heading}</h2>
        )}
        <div
          ref={rowRef}
          className={cn(
            "flex gap-5 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
            !hasOverflow && "justify-center",
          )}
        >
          {cards.map((card, i) => (
            <div
              key={i}
              className="w-[70vw] shrink-0 overflow-hidden rounded-2xl bg-white shadow-brand mb-50 sm:w-[calc((100%-40px)/3)] mt-100"
            >
              <div className="p-3">
                <div className="aspect-[4/3] overflow-hidden rounded-xl bg-beige">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={card.imageUrl} alt="" className="h-full w-full object-cover" />
                </div>
                {card.caption && <p className="pt-3 font-ui text-sm text-ink">{card.caption}</p>}
              </div>
            </div>
          ))}
        </div>
        {/* The card's own mb-50 adds 200px of trailing space inside the row
            above (flexbox doesn't collapse margins the way block layout
            does, so that space becomes part of the row's box) — this
            negative margin cancels it back out so the arrows sit ~28px
            below the card's actual bottom edge instead of ~244px below it.
            If the card's mb-* changes, this needs to change with it. */}
        <div className="-mt-44 flex justify-center gap-3">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => scroll(-1)}
            className="grid h-9 w-9 place-items-center rounded-full bg-white text-ink shadow-brand hover:bg-cream"
          >
            {chevronLeft}
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => scroll(1)}
            className="grid h-9 w-9 place-items-center rounded-full bg-white text-ink shadow-brand hover:bg-cream"
          >
            {chevronRight}
          </button>
        </div>
      </div>
    </div>
  );
}
