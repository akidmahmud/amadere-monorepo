"use client";

import { useEffect, useRef, useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { cn } from "../lib/cn";

export interface HeroSlide {
  imageUrl: string;
  linkUrl?: string;
}

export interface HeroCarouselProps {
  slides?: HeroSlide[];
  /** The reference design's fixed side banner — same slot as before (config.stripImageUrl/stripLinkUrl), now rendered beside the slider instead of as a strip underneath it. */
  stripImageUrl?: string;
  stripLinkUrl?: string;
  linkComponent?: LinkComponent;
  /** Only relevant with 2+ slides — how often it auto-advances. */
  autoplayMs?: number;
}

const prevIcon = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);
const nextIcon = (
  <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

// Fixed 5:2 (desktop) → 16:7 (≤1024px) → 16:9 (≤768px) aspect ratio, not an
// auto-detected-from-the-first-image ratio — the reference's own hero
// matrix is a fixed-proportion slider + side banner grid, and a variable
// aspect ratio would make the side banner (which stretches to match the
// slider's height) resize unpredictably per slide.
const sliderAspect = "aspect-[5/2] max-lg:aspect-[16/7] max-md:aspect-[16/9]";
const bannerRadius = "rounded-[14px] shadow-[0_6px_22px_rgba(30,43,34,.08)]";

// Both empty-state backgrounds (#e9dfcd tan, #dfe8d9 sage) are light, unlike
// the reference's own placeholder slides (dark gradients) — dark text/border
// here instead of the reference's white, or it's invisible on these tones.
function EmptySlot({ label }: { label: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2.5 p-5 text-center text-ink/70">
      <div className="rounded-[10px] border-[1.5px] border-dashed border-ink/30 px-[18px] py-2.5 text-[0.8rem] font-bold tracking-wide">{label}</div>
    </div>
  );
}

export function HeroCarousel({ slides, stripImageUrl, stripLinkUrl, linkComponent: Link = DefaultLink, autoplayMs = 5000 }: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const touchStartX = useRef<number | null>(null);

  // Defense in depth: admin-entered config can end up with a slide that has
  // no image yet (e.g. "Add slide" clicked before an upload finishes) — an
  // empty imageUrl must never reach `<img src>`, so filter here regardless
  // of whether the admin form that produced this config already validates it.
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

  return (
    <div className="mx-auto w-full max-w-[1440px] px-6 py-6 max-md:py-4">
      {/* Main slider (~972px, flex:1) + fixed 400px side banner, equal
          heights (items-stretch) — stacks to a single column at ≤1024px. */}
      <div className="grid grid-cols-1 items-stretch gap-5 lg:grid-cols-[1fr_400px]">
        <div
          className={cn("relative overflow-hidden bg-[#e9dfcd]", sliderAspect, bannerRadius)}
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
          {slideTotal === 0 ? (
            <EmptySlot label="Add a hero slide" />
          ) : (
            <>
              <div className="absolute inset-0">
                {validSlides.map((slide, i) => {
                  const img = <img src={slide.imageUrl} alt="" className="h-full w-full object-cover" />;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "absolute inset-0 flex items-center justify-center transition-opacity duration-[550ms] ease-in-out",
                        i === index ? "z-[1] opacity-100" : "opacity-0",
                      )}
                    >
                      {slide.linkUrl ? <Link href={slide.linkUrl}>{img}</Link> : img}
                    </div>
                  );
                })}
              </div>
              {slideTotal > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous slide"
                    onClick={() => go(-1)}
                    className="absolute left-4 top-1/2 z-[3] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-green shadow-[0_4px_14px_rgba(30,43,34,.22)] transition-[background-color,color,transform] hover:bg-green hover:text-white active:scale-[0.94]"
                  >
                    {prevIcon}
                  </button>
                  <button
                    type="button"
                    aria-label="Next slide"
                    onClick={() => go(1)}
                    className="absolute right-4 top-1/2 z-[3] grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full bg-white text-green shadow-[0_4px_14px_rgba(30,43,34,.22)] transition-[background-color,color,transform] hover:bg-green hover:text-white active:scale-[0.94]"
                  >
                    {nextIcon}
                  </button>
                  <div className="absolute bottom-4 left-6 z-[3] flex gap-2">
                    {validSlides.map((_, i) => (
                      <button
                        key={i}
                        type="button"
                        aria-label={`Go to slide ${i + 1}`}
                        onClick={() => setIndex(i)}
                        className={cn(
                          "h-[9px] rounded-full transition-[width,background-color] duration-200",
                          i === index ? "w-[22px] rounded-[5px] bg-gold" : "w-[9px] bg-white/55",
                        )}
                      />
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>

        {stripImageUrl ? (
          (() => {
            const bannerImg = <img src={stripImageUrl} alt="" className="h-full w-full object-cover" />;
            // w-full pins this to its 400px grid column — without it, aspect-[5/2]
            // combined with lg:h-full computes a *preferred* width from the
            // ratio (height × 2.5 ≈ 972px, matching the slider's own width)
            // instead of stretching to the track, and grid doesn't clip an
            // item that's wider than its own column, so it visibly overflowed
            // past the 400px track into the page's right margin.
            const bannerClass = cn("relative block w-full overflow-hidden bg-[#dfe8d9] lg:h-full", sliderAspect, bannerRadius);
            return stripLinkUrl ? (
              <Link href={stripLinkUrl} className={bannerClass}>
                {bannerImg}
              </Link>
            ) : (
              <div className={bannerClass}>{bannerImg}</div>
            );
          })()
        ) : (
          <div className={cn("relative w-full overflow-hidden bg-[#dfe8d9] lg:h-full", sliderAspect, bannerRadius)}>
            <EmptySlot label="Add a side banner" />
          </div>
        )}
      </div>
    </div>
  );
}
