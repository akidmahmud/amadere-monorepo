"use client";

import { useEffect, useRef, useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { cn } from "../lib/cn";

export interface HomeBannerTwoSlide {
  imageUrl: string;
  /** Falls back to `imageUrl` when unset — most banners can reuse the same art at mobile width. */
  mobileImageUrl?: string;
  linkUrl?: string;
}

export interface HomeBannerTwoProps {
  slides?: HomeBannerTwoSlide[];
  linkComponent?: LinkComponent;
  autoplayMs?: number;
}

// Full-bleed single banner (no side-banner slot, unlike HeroCarousel) — dot
// pagination sits in its own row below the image at every breakpoint,
// matching the reference's swiper (organicindia.com), instead of overlaid
// bottom-left on desktop.
// Scaling matches the reference's own `.two-link-slide-img` exactly: no
// fixed-aspect-ratio box, no object-fit — just `width:100%; height:auto` on
// whichever image is showing, so the box is always exactly as tall as that
// image scales to. That's what makes it crop-free and gap-free at every
// width, on any image shape, with zero per-breakpoint tuning. The trade-off
// (also true of the reference): only one slide is in the DOM at a time, so
// slide changes are an instant swap, not a crossfade — a fade would require
// stacking multiple slides in the same fixed-size box, which is exactly the
// object-fit/letterboxing problem this avoids.
export function HomeBannerTwo({ slides, linkComponent: Link = DefaultLink, autoplayMs = 5000 }: HomeBannerTwoProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  const validSlides = slides?.filter((slide) => slide.imageUrl) ?? [];
  const slideTotal = validSlides.length;

  useEffect(() => {
    if (slideTotal <= 1 || paused) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slideTotal), autoplayMs);
    return () => clearInterval(timer);
  }, [slideTotal, autoplayMs, paused]);

  function go(delta: number) {
    setIndex((i) => (i + delta + slideTotal) % slideTotal);
  }

  if (slideTotal === 0) return null;

  const slide = validSlides[index];
  const img = (
    <picture>
      {slide.mobileImageUrl && <source media="(max-width: 767px)" srcSet={slide.mobileImageUrl} />}
      <img key={index} src={slide.imageUrl} alt="" className="block h-auto w-full" />
    </picture>
  );

  return (
    <div className="mx-auto w-full px-0 pb-6 pt-0 max-md:pb-4">
      <div
        className="relative bg-[#e9dfcd]"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onTouchStart={(e) => (touchStartX.current = e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchStartX.current === null || slideTotal <= 1) return;
          const dx = e.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          touchStartX.current = null;
        }}
      >
        {slide.linkUrl ? <Link href={slide.linkUrl}>{img}</Link> : img}

        {slideTotal > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous slide"
              onClick={() => go(-1)}
              className="absolute left-4 top-1/2 z-[3] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-green shadow-[0_4px_14px_rgba(30,43,34,.22)] transition-[background-color,color,transform] hover:bg-green hover:text-white active:scale-[0.94] max-md:hidden"
            >
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <line x1="19" y1="12" x2="5" y2="12" />
                <polyline points="12 19 5 12 12 5" />
              </svg>
            </button>
            <button
              type="button"
              aria-label="Next slide"
              onClick={() => go(1)}
              className="absolute right-4 top-1/2 z-[3] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-green shadow-[0_4px_14px_rgba(30,43,34,.22)] transition-[background-color,color,transform] hover:bg-green hover:text-white active:scale-[0.94] max-md:hidden"
            >
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12 5 19 12 12 19" />
              </svg>
            </button>
          </>
        )}
      </div>

      {slideTotal > 1 && (
        <div className="flex justify-center gap-2 pt-[15px]">
          {validSlides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn(
                "h-[9px] rounded-full transition-[width,background-color] duration-200",
                i === index ? "w-[22px] rounded-[5px] bg-green" : "w-[9px] bg-line",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
