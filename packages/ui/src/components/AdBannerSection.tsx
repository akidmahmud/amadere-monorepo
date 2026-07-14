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
  // Source images are ideally 1686×759 — same blurred-fill treatment as
  // Hero Banner/Banner Strip so any off-ratio ad image still shows in full.
  const image = (
    <div className="relative aspect-[1686/759] w-full overflow-hidden rounded-2xl bg-gray">
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
