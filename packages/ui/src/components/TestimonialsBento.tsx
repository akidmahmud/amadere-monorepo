"use client";

import { Carousel } from "./Carousel";

export interface TestimonialReview {
  quote: string;
  name: string;
  role?: string;
  avatarUrl?: string;
  /** 1-5, defaults to 5 (ghorerbazar.com's own reviews are all shown as 5-star). */
  rating?: number;
}

export interface TestimonialsBentoProps {
  reviews?: TestimonialReview[];
  /** Auto-advance one "page" every N ms — on by default (4500ms) so this
   * carousel behaves like every other one on the homepage; pass 0 to disable. */
  autoplayMs?: number;
}

const starIcon = (filled: boolean) => (
  <svg viewBox="0 0 24 24" width={14} height={14} fill="currentColor" className={`shrink-0 ${filled ? "text-gold" : "text-line"}`}>
    <path d="M12 2.5l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.9-6.2 3.9 1.6-7-5.4-4.7 7.1-.6z" />
  </svg>
);

function ReviewCard({ review }: { review: TestimonialReview }) {
  const rating = review.rating ?? 5;
  return (
    <div className="flex w-full shrink-0 snap-start flex-col rounded-brand border border-line bg-white p-4 sm:w-[340px] sm:p-6 lg:w-[380px]">
      <p className="min-h-[78px] text-sm leading-relaxed text-muted">{review.quote}</p>
      <div className="mt-3.5 mb-3.5 flex gap-0.5">
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i}>{starIcon(i < rating)}</span>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2">
        <span className="h-[52px] w-[52px] shrink-0 overflow-hidden rounded-full bg-beige">
          {review.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={review.avatarUrl} alt="" className="h-full w-full object-cover" />
          )}
        </span>
        <span>
          <span className="block text-sm font-semibold text-ink">{review.name}</span>
          {review.role && <span className="block text-xs text-muted">{review.role}</span>}
        </span>
      </div>
    </div>
  );
}

// The homepage-sections module ships this (type TESTIMONIAL_BENTO) — a
// horizontal carousel of quote cards (quote, star rating, avatar/name/role),
// matching ghorerbazar.com's testimonial section design (size/layout, not
// its orange brand color — this project's own gold/green tokens instead,
// same convention already used for the product-card rebuild elsewhere in
// this codebase). Empty gray-avatar cards with no reviews just render
// nothing (see the early return below), same as every other admin-driven
// homepage section.
export function TestimonialsBento({ reviews = [], autoplayMs = 4500 }: TestimonialsBentoProps) {
  if (reviews.length === 0) return null;

  return (
    <Carousel autoplayMs={autoplayMs} compactArrowsOnMobile>
      {reviews.map((review, i) => (
        <ReviewCard key={i} review={review} />
      ))}
    </Carousel>
  );
}
