"use client";

import { useEffect, useRef, useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { cn } from "../lib/cn";
import { PlaceholderBanner } from "./PlaceholderBanner";

export interface HeroSlide {
  imageUrl: string;
  linkUrl?: string;
}

export interface HeroCarouselProps {
  slides?: HeroSlide[];
  stripImageUrl?: string;
  stripLinkUrl?: string;
  linkComponent?: LinkComponent;
  slideCount?: number;
  activeSlide?: number;
  /** Only relevant with 2+ slides — how often it auto-advances. */
  autoplayMs?: number;
}

// Placeholder used only until the first real slide's image finishes loading
// and reports its actual size (see handleFirstImageLoad below) — keeps the
// box from being empty/collapsed during that brief window, close enough to
// the old fixed 1882:500 design constant that there's no visible jump once
// the real ratio is measured.
const DEFAULT_HERO_RATIO = 1882 / 500;

// The banner module now ships (HomepageSection, type HERO_BANNER) — real
// slides render here; the placeholder-with-dots stays as the empty-state
// fallback until an admin adds at least one slide.
export function HeroCarousel({
  slides,
  stripImageUrl,
  stripLinkUrl,
  linkComponent: Link = DefaultLink,
  slideCount = 8,
  activeSlide = 0,
  autoplayMs = 5000,
}: HeroCarouselProps) {
  const [index, setIndex] = useState(0);
  const [lockedRatio, setLockedRatio] = useState<number | null>(null);
  const hasLockedRatio = useRef(false);

  // Defense in depth: admin-entered config can end up with a slide that has
  // no image yet (e.g. "Add slide" clicked before an upload finishes) — an
  // empty imageUrl must never reach `<img src>`, so filter here regardless
  // of whether the admin form that produced this config already validates it.
  const validSlides = slides?.filter((slide) => slide.imageUrl);
  const slideTotal = validSlides?.length ?? 0;

  useEffect(() => {
    if (slideTotal <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % slideTotal), autoplayMs);
    return () => clearInterval(timer);
  }, [slideTotal, autoplayMs]);

  // Locks the carousel's box to whichever slide's image finishes loading
  // first — in practice always the first slide, since it starts loading
  // immediately on mount and autoplayMs (5s+) gives it plenty of time to
  // finish before the carousel could advance to slide 2. The ref guard
  // means every later slide (matching or mismatched size) renders inside
  // this same fixed box instead of each slide independently resizing it.
  function handleFirstImageLoad(e: React.SyntheticEvent<HTMLImageElement>) {
    if (hasLockedRatio.current) return;
    hasLockedRatio.current = true;
    const { naturalWidth, naturalHeight } = e.currentTarget;
    if (naturalWidth > 0 && naturalHeight > 0) setLockedRatio(naturalWidth / naturalHeight);
  }

  if (!validSlides || validSlides.length === 0) {
    return (
      <div>
        <PlaceholderBanner variant="hero" dotCount={slideCount} activeDot={activeSlide} />
        <PlaceholderBanner variant="strip" className="mt-5" />
      </div>
    );
  }

  const current = validSlides[Math.min(index, validSlides.length - 1)];
  // Box height is locked to the first slide's real aspect ratio (see
  // handleFirstImageLoad) instead of each slide having independent height —
  // a mismatched-size slide crops to fill (object-cover, no distortion)
  // instead of changing the carousel's height as it transitions.
  const image = (
    <div
      className="relative w-full overflow-hidden bg-gray"
      style={{ aspectRatio: lockedRatio ?? DEFAULT_HERO_RATIO }}
    >
      <img src={current.imageUrl} alt="" onLoad={handleFirstImageLoad} className="h-full w-full object-cover" />
    </div>
  );

  return (
    <div>
      <div className="relative">
        {current.linkUrl ? <Link href={current.linkUrl}>{image}</Link> : image}
        {validSlides.length > 1 && (
          <div className="absolute bottom-3.5 left-1/2 flex -translate-x-1/2 gap-2">
            {validSlides.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-[9px] w-[9px] rounded-full",
                  i === index ? "bg-[#333]" : "bg-white",
                )}
              />
            ))}
          </div>
        )}
      </div>
      {stripImageUrl &&
        (stripLinkUrl ? (
          <Link href={stripLinkUrl}>
            <img
              src={stripImageUrl}
              alt=""
              className="mt-5 h-[150px] w-full rounded-2xl object-cover"
            />
          </Link>
        ) : (
          <img
            src={stripImageUrl}
            alt=""
            className="mt-5 h-[150px] w-full rounded-2xl object-cover"
          />
        ))}
    </div>
  );
}
