"use client";

import { useState } from "react";
import Image from "next/image";
import { cn } from "../lib/cn";

export interface ProductGalleryImage {
  url: string;
  alt?: string;
}

export interface ProductGalleryProps {
  images: ProductGalleryImage[];
  /** Embeddable video URL (e.g. YouTube/Vimeo) shown as an extra gallery slide. */
  videoUrl?: string;
  className?: string;
}

const chevronLeft = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-[18px] w-[18px]">
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const chevronRight = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-[18px] w-[18px]">
    <path d="m9 6 6 6-6 6" />
  </svg>
);
const playIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-[#F48721]">
    <path d="M8 5v14l11-7z" />
  </svg>
);

// Layout matches the reference PDP exactly: a vertical thumbnail column to the
// left (50x50px tiles — re-measured at mobile width, was wrongly 80x80,
// which starved the main image of width — 10px gap, 1px border —
// always-visible faint border on inactive tiles, orange on the active one)
// and the main image to the right (4px radius, no container chrome), with
// plain (no button-circle/shadow) prev/next arrows overlaid 10px in from the
// main image's edges — all measured directly against the reference's own
// Swiper markup (.p-details-big-img / .p-thumb-img-slider), including its
// literal unstyled-Swiper-default arrow blue (#007AFF), not a brand color.
// Unchanged down to mobile widths — the reference keeps this side-by-side
// layout at 390px too, no stacking breakpoint.
export function ProductGallery({ images, videoUrl, className }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const slideCount = images.length + (videoUrl ? 1 : 0);
  const showVideo = videoUrl && active === images.length;
  const current = images[Math.min(active, images.length - 1)];

  return (
    <div className={cn("flex gap-4", className)}>
      {(images.length > 1 || videoUrl) && (
        <div className="flex w-[50px] shrink-0 flex-col gap-2.5 overflow-hidden max-h-[260px] md:w-[80px] md:max-h-[458px]">
          {images.map((image, i) => (
            <button
              key={image.url + i}
              type="button"
              aria-label={`View image ${i + 1}`}
              onClick={() => setActive(i)}
              className={cn(
                "relative h-[50px] w-[50px] shrink-0 overflow-hidden rounded border bg-white md:h-[80px] md:w-[80px]",
                active === i ? "border-[#F48721]" : "border-[rgba(34,40,49,0.11)]",
              )}
            >
              <Image src={image.url} alt="" fill sizes="80px" className="object-contain" />
            </button>
          ))}
          {videoUrl && (
            <button
              type="button"
              aria-label="Play product video"
              onClick={() => setActive(images.length)}
              className={cn(
                "grid h-[50px] w-[50px] shrink-0 place-items-center rounded border bg-white md:h-[80px] md:w-[80px]",
                active === images.length ? "border-[#F48721]" : "border-[rgba(34,40,49,0.11)]",
              )}
            >
              {playIcon}
            </button>
          )}
        </div>
      )}

      {/* Square at all breakpoints, matching ghorerbazar.com's product
          gallery exactly: their image container is naturally square (1:1
          source images with width:100%), no explicit height cap. */}
      <div className="relative aspect-square min-w-0 flex-1">
        {showVideo ? (
          <iframe
            src={videoUrl}
            title="Product video"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full rounded"
          />
        ) : (
          current?.url && (
            <Image
              src={current.url}
              alt={current.alt ?? ""}
              fill
              // The single biggest LCP element on a product page (brief §4)
              // only when it's the FIRST slide — later slides are switched
              // to client-side by clicking a thumbnail, never the initial
              // paint, so they stay lazy like everything else below the fold.
              priority={active === 0}
              sizes="(max-width: 768px) 100vw, 50vw"
              className="rounded object-contain"
            />
          )
        )}

        {slideCount > 1 && (
          <>
            <button
              type="button"
              aria-label="Previous"
              onClick={() => setActive((i) => (i - 1 + slideCount) % slideCount)}
              className="absolute left-2.5 top-1/2 grid h-11 w-7 -translate-y-1/2 place-items-center text-[#007AFF]"
            >
              {chevronLeft}
            </button>
            <button
              type="button"
              aria-label="Next"
              onClick={() => setActive((i) => (i + 1) % slideCount)}
              className="absolute right-2.5 top-1/2 grid h-11 w-7 -translate-y-1/2 place-items-center text-[#007AFF]"
            >
              {chevronRight}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
