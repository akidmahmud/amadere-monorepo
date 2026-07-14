"use client";

import { useState } from "react";
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
}

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
}: HeroCarouselProps) {
  const [index, setIndex] = useState(0);

  // Defense in depth: admin-entered config can end up with a slide that has
  // no image yet (e.g. "Add slide" clicked before an upload finishes) — an
  // empty imageUrl must never reach `<img src>`, so filter here regardless
  // of whether the admin form that produced this config already validates it.
  const validSlides = slides?.filter((slide) => slide.imageUrl);

  if (!validSlides || validSlides.length === 0) {
    return (
      <div>
        <PlaceholderBanner variant="hero" dotCount={slideCount} activeDot={activeSlide} />
        <PlaceholderBanner variant="strip" className="mt-5" />
      </div>
    );
  }

  const current = validSlides[Math.min(index, validSlides.length - 1)];
  // Source slides are ideally authored at 1882×500 (see admin's Hero Banner
  // editor hint), but admins will upload whatever shape they have — a plain
  // object-cover crops anything off-ratio (looks "zoomed"), and a plain
  // object-contain leaves empty gaps. This shows the full image uncropped,
  // with a softly blurred copy of the same image filling the rest of the
  // box, so any image shape still looks intentional rather than letterboxed.
  const image = (
    <div className="relative aspect-[1882/500] w-full overflow-hidden rounded-2xl bg-gray">
      <img
        src={current.imageUrl}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
      />
      <img src={current.imageUrl} alt="" className="relative h-full w-full object-contain" />
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
