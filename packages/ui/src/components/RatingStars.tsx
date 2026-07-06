"use client";

import { cn } from "../lib/cn";

export interface RatingStarsProps {
  rating: number;
  count?: number;
  max?: number;
  size?: number;
  className?: string;
}

function Star({ filled, size }: { filled: boolean; size: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth={filled ? 0 : 1.5}
      className={filled ? "text-gold" : "text-line"}
    >
      <path d="m12 3 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.8 6.1 21l1.2-6.5L2.5 9.9l6.6-.9z" />
    </svg>
  );
}

export function RatingStars({
  rating,
  count,
  max = 5,
  size = 16,
  className,
}: RatingStarsProps) {
  return (
    <div
      className={cn("flex items-center gap-1.5", className)}
      role="img"
      aria-label={`Rated ${rating} out of ${max}`}
    >
      <div className="flex gap-0.5">
        {Array.from({ length: max }).map((_, i) => (
          <Star key={i} filled={i < Math.round(rating)} size={size} />
        ))}
      </div>
      {count !== undefined && (
        <span className="font-body text-xs text-muted">({count})</span>
      )}
    </div>
  );
}
