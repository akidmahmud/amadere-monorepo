"use client";

import { useState } from "react";

const playIcon = (
  <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-[22px] w-[22px]">
    <path d="M8 5v14l11-7z" />
  </svg>
);
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

export interface TestimonialVideo {
  url: string;
  thumbnailUrl?: string;
}

export interface TestimonialReview {
  quote: string;
  name: string;
}

export interface TestimonialsBentoProps {
  videos?: TestimonialVideo[];
  reviews?: TestimonialReview[];
  dotCount?: number;
  activeDot?: number;
}

function ReviewCard({ review }: { review: TestimonialReview }) {
  return (
    <div className="rounded-brand bg-beige p-5">
      <p className="text-sm leading-relaxed text-ink">{review.quote}</p>
      <p className="mt-3 text-sm font-bold text-ink">{review.name}</p>
    </div>
  );
}

// The homepage-sections module ships this (type TESTIMONIAL_BENTO) — a
// left video player (cycles through multiple uploaded clips via the
// prev/next arrows) and a right-side two-column masonry of real review
// quotes. Empty gray tiles are the fallback for whichever half has no
// content yet, so the layout is still visible before an admin fills it in.
export function TestimonialsBento({
  videos = [],
  reviews = [],
  dotCount = 8,
  activeDot = 0,
}: TestimonialsBentoProps) {
  const [activeVideo, setActiveVideo] = useState(0);
  const video = videos[activeVideo];
  const leftReviews = reviews.filter((_, i) => i % 2 === 0);
  const rightReviews = reviews.filter((_, i) => i % 2 === 1);

  return (
    <div className="grid grid-cols-[180px_1fr_20px] gap-4">
      <div className="relative grid min-h-[380px] place-items-center overflow-hidden rounded-brand bg-gray">
        {video?.thumbnailUrl && (
          <img src={video.thumbnailUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {videos.length > 1 && (
          <button
            type="button"
            aria-label="Previous video"
            onClick={() => setActiveVideo((i) => (i - 1 + videos.length) % videos.length)}
            className="absolute left-2.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-[9px] bg-gold text-white shadow-brand"
          >
            {chevronLeft}
          </button>
        )}
        {video?.url && (
          <a
            href={video.url}
            target="_blank"
            rel="noreferrer"
            className="relative grid h-14 w-14 place-items-center rounded-full bg-green text-white shadow-[0_6px_18px_rgba(0,0,0,.25)]"
          >
            {playIcon}
          </a>
        )}
        {videos.length > 1 && (
          <button
            type="button"
            aria-label="Next video"
            onClick={() => setActiveVideo((i) => (i + 1) % videos.length)}
            className="absolute right-2.5 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-[9px] bg-gold text-white shadow-brand"
          >
            {chevronRight}
          </button>
        )}
      </div>

      {reviews.length > 0 ? (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-4">
            {leftReviews.map((r, i) => (
              <ReviewCard key={i} review={r} />
            ))}
          </div>
          <div className="flex flex-col gap-4">
            {rightReviews.map((r, i) => (
              <ReviewCard key={i} review={r} />
            ))}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 auto-rows-[110px] gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-brand bg-gray" />
          ))}
        </div>
      )}

      <div className="flex flex-col items-center justify-center gap-2">
        {Array.from({ length: dotCount }).map((_, i) => (
          <i key={i} className={`h-2 w-2 rounded-full ${i === activeDot ? "bg-green" : "bg-line"}`} />
        ))}
      </div>
    </div>
  );
}
