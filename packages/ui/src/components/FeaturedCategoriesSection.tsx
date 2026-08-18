"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
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

// card 105 + gap 16 = 121/card at mobile; scrolls ~3 cards per arrow click.
const SCROLL_STEP = 360;

// Pixel-matched to ghorerbazar.com's `.category.style-3.section-padding`
// (mobile measured first, then desktop — per explicit request): 16px section
// padding (flat, no responsive scale-up), near-full-bleed 105px/100px
// image tiles (only a ~2.5px inset, not a padded icon-in-a-box look) with
// 20px corner radius, 16px gap, dark-ink medium-weight heading (this
// section's own heading is NOT the green/extrabold treatment used
// elsewhere on our site — the reference itself doesn't color it either),
// and small solid-circle arrows.
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
    <section className="py-4">
      <div className="mx-auto max-w-[1440px] px-4 md:px-6">
        <h2 className="mb-6 text-center font-serif text-[22px] font-semibold text-green md:text-[30px]">
          {heading}
        </h2>

        <div className="relative">
          <button
            type="button"
            aria-label="Scroll categories left"
            onClick={() => scrollBy(-SCROLL_STEP)}
            className="absolute -left-[18px] top-[52px] z-[5] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-green text-white transition-colors hover:bg-green-dark md:top-[72px]"
          >
            {prevIcon}
          </button>

          <div
            ref={trackRef}
            className="flex gap-4 overflow-x-auto p-1 [scroll-snap-type:x_mandatory] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item) => (
              <Link key={item.href} href={item.href} className="group flex-none basis-[105px] text-center [scroll-snap-align:start] md:basis-[145px]">
                <div className="flex h-[100px] w-[100px] items-center justify-center overflow-hidden rounded-[20px] bg-white p-0.5 transition-transform duration-200 group-hover:-translate-y-1 md:h-[140px] md:w-[140px]">
                  {item.imageUrl ? (
                    <Image
                      src={item.imageUrl}
                      alt=""
                      width={140}
                      height={140}
                      className="h-full w-full rounded-[20px] object-contain"
                    />
                  ) : (
                    <div className="h-full w-full rounded-[20px] bg-beige" />
                  )}
                </div>
                <div className="mt-2.5 font-body text-sm font-medium text-header-ink group-hover:text-header-green">
                  {item.name}
                </div>
              </Link>
            ))}
          </div>

          <button
            type="button"
            aria-label="Scroll categories right"
            onClick={() => scrollBy(SCROLL_STEP)}
            className="absolute -right-[18px] top-[52px] z-[5] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-green text-white transition-colors hover:bg-green-dark md:top-[72px]"
          >
            {nextIcon}
          </button>
        </div>
      </div>
    </section>
  );
}
