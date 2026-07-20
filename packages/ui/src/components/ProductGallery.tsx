"use client";

import { useState } from "react";
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

export function ProductGallery({ images, videoUrl, className }: ProductGalleryProps) {
  const [active, setActive] = useState(0);
  const slideCount = images.length + (videoUrl ? 1 : 0);
  const showVideo = videoUrl && active === images.length;
  const current = images[Math.min(active, images.length - 1)];

  return (
    <div className={className}>
      <div className="aspect-square overflow-hidden rounded-[40px] bg-beige">
        {showVideo ? (
          <iframe
            src={videoUrl}
            title="Product video"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="h-full w-full"
          />
        ) : (
          current?.url && (
            <img src={current.url} alt={current.alt ?? ""} className="h-full w-full object-cover" />
          )
        )}
      </div>
      {(images.length > 1 || videoUrl) && (
        <div className="mt-3.5 flex items-center gap-3">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => setActive((i) => (i - 1 + slideCount) % slideCount)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-white hover:bg-gold-dark"
          >
            {chevronLeft}
          </button>
          <div className="flex flex-1 gap-3 overflow-x-auto">
            {images.map((image, i) => (
              <button
                key={image.url + i}
                type="button"
                aria-label={`View image ${i + 1}`}
                onClick={() => setActive(i)}
                className={cn(
                  "h-[70px] w-[70px] shrink-0 overflow-hidden rounded-[10px] border-2 bg-beige",
                  active === i ? "border-green" : "border-transparent",
                )}
              >
                <img src={image.url} alt="" className="h-full w-full object-cover" />
              </button>
            ))}
            {videoUrl && (
              <button
                type="button"
                aria-label="Play product video"
                onClick={() => setActive(images.length)}
                className={cn(
                  "grid h-[70px] w-[70px] shrink-0 place-items-center rounded-[10px] border-2 bg-beige",
                  active === images.length ? "border-green" : "border-transparent",
                )}
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5 text-green">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </button>
            )}
          </div>
          <button
            type="button"
            aria-label="Next"
            onClick={() => setActive((i) => (i + 1) % slideCount)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gold text-white hover:bg-gold-dark"
          >
            {chevronRight}
          </button>
        </div>
      )}
    </div>
  );
}
