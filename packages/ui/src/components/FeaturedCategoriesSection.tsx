"use client";

import { useEffect, useRef } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface FeaturedCategoryItem {
  href: string;
  name: string;
  imageUrl?: string;
}

export interface FeaturedCategoriesSectionProps {
  heading?: string;
  items: FeaturedCategoryItem[];
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

// card 150 + gap 20 = 170/card; the reference scrolls 3 cards per arrow
// click at a fixed 510px regardless of breakpoint (its own script doesn't
// recompute this for the mobile 120px card size either).
const SCROLL_STEP = 510;

// Pixel-matched to amader-home-top.html's "Featured Categories" section —
// card/tile/gap/arrow sizes, positions, and the single 768px responsive
// tier are all literal values from that file, not the site's usual
// Carousel/SectionHeading/CategoryCard components (which use different
// sizing entirely).
export function FeaturedCategoriesSection({ heading = "Featured Categories", items, linkComponent: Link = DefaultLink }: FeaturedCategoriesSectionProps) {
  const trackRef = useRef<HTMLDivElement>(null);

  function scrollBy(delta: number) {
    trackRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  }

  // Auto-advances every 4s, looping back to the start once scrolled to the
  // end — skips the tick entirely when everything already fits (no real
  // overflow to scroll through).
  useEffect(() => {
    const timer = setInterval(() => {
      const track = trackRef.current;
      if (!track || track.scrollWidth <= track.clientWidth + 4) return;
      const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 4;
      if (atEnd) track.scrollTo({ left: 0, behavior: "smooth" });
      else scrollBy(SCROLL_STEP);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  if (items.length === 0) return null;

  return (
    <section className="pt-10 md:pt-14">
      <div className="mx-auto max-w-[1440px] px-4 md:px-6">
        <h2 className="mb-[22px] text-center font-header text-[1.3rem] font-extrabold tracking-[-0.01em] text-[#227840] md:mb-[30px] md:text-[1.6rem]">
          {heading}
        </h2>

        <div className="relative">
          <button
            type="button"
            aria-label="Scroll categories left"
            onClick={() => scrollBy(-SCROLL_STEP)}
            className="absolute -left-2 top-[60px] z-[5] grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-gold text-[#3d3410] shadow-[0_4px_12px_rgba(30,43,34,.2)] transition-colors hover:bg-header-green hover:text-white md:-left-[14px] md:top-[75px]"
          >
            {prevIcon}
          </button>

          <div
            ref={trackRef}
            className="flex gap-5 overflow-x-auto p-1 [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item) => (
              <Link key={item.href} href={item.href} className="group flex-none basis-[120px] text-center [scroll-snap-align:start] md:basis-[150px]">
                <div className="flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-2xl border border-transparent bg-white shadow-[0_3px_14px_rgba(30,43,34,.07)] transition-[transform,border-color,box-shadow] duration-200 group-hover:-translate-y-1 group-hover:border-header-green group-hover:shadow-[0_8px_22px_rgba(33,113,61,.16)] md:h-[150px] md:w-[150px]">
                  {item.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.imageUrl} alt="" className="h-full w-full object-contain p-[18px]" />
                  ) : (
                    <div className="h-full w-full bg-beige" />
                  )}
                </div>
                <div className="mt-3 font-header text-[0.88rem] font-bold text-header-ink group-hover:text-header-green">
                  {item.name}
                </div>
              </Link>
            ))}
          </div>

          <button
            type="button"
            aria-label="Scroll categories right"
            onClick={() => scrollBy(SCROLL_STEP)}
            className="absolute -right-2 top-[60px] z-[5] grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full bg-gold text-[#3d3410] shadow-[0_4px_12px_rgba(30,43,34,.2)] transition-colors hover:bg-header-green hover:text-white md:-right-[14px] md:top-[75px]"
          >
            {nextIcon}
          </button>
        </div>
      </div>
    </section>
  );
}
