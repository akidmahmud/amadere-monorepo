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

  if (!slides || slides.length === 0) {
    return (
      <div>
        <PlaceholderBanner variant="hero" dotCount={slideCount} activeDot={activeSlide} />
        <PlaceholderBanner variant="strip" className="mt-5" />
      </div>
    );
  }

  const current = slides[Math.min(index, slides.length - 1)];
  const image = (
    <img
      src={current.imageUrl}
      alt=""
      className="h-[300px] w-full rounded-2xl object-cover"
    />
  );

  return (
    <div>
      <div className="relative">
        {current.linkUrl ? <Link href={current.linkUrl}>{image}</Link> : image}
        {slides.length > 1 && (
          <div className="absolute bottom-3.5 left-1/2 flex -translate-x-1/2 gap-2">
            {slides.map((_, i) => (
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
