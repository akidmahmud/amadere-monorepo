"use client";

import { useEffect, useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { cn } from "../lib/cn";

export interface AdBannerImage {
  imageUrl: string;
  linkUrl?: string;
}

export interface AdBannerSectionProps {
  images: AdBannerImage[];
  /** Only relevant with 2+ images — how often it auto-advances. */
  autoplayMs?: number;
  linkComponent?: LinkComponent;
}

// One image = plain static banner. More than one = an auto-advancing slider
// (dot indicators double as manual override), same visual language as
// HeroCarousel but with a real autoplay timer, which that one doesn't have.
export function AdBannerSection({ images, autoplayMs = 4000, linkComponent: Link = DefaultLink }: AdBannerSectionProps) {
  const valid = images.filter((i) => i.imageUrl);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (valid.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % valid.length), autoplayMs);
    return () => clearInterval(timer);
  }, [valid.length, autoplayMs]);

  if (valid.length === 0) return null;

  const current = valid[Math.min(index, valid.length - 1)];
  // Fixed 1686x759 box per design spec on desktop — crops to fill
  // (object-cover), never distorts. A literal 759px height at every
  // breakpoint would force that same height on a ~375px-wide phone screen
  // too, cropping down to a thin vertical sliver of the image — mobile uses
  // the same 1686:759 aspect ratio responsively instead, so the banner
  // scales proportionally with viewport width until the desktop breakpoint
  // switches to the exact fixed-height spec.
  const image = (
    <div className="relative mx-auto aspect-[1686/759] w-full max-w-[1686px] overflow-hidden rounded-[20px] bg-gray sm:aspect-auto sm:h-[759px]">
      <img src={current.imageUrl} alt="" className="h-full w-full object-cover" />
    </div>
  );

  return (
    <div className="relative">
      {current.linkUrl ? <Link href={current.linkUrl}>{image}</Link> : image}
      {valid.length > 1 && (
        <div className="absolute bottom-3.5 left-1/2 flex -translate-x-1/2 gap-2">
          {valid.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={cn("h-[9px] w-[9px] rounded-full", i === index ? "bg-[#333]" : "bg-white")}
            />
          ))}
        </div>
      )}
    </div>
  );
}
