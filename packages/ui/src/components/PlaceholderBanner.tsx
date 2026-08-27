"use client";

import { cn } from "../lib/cn";

export type PlaceholderBannerVariant = "hero" | "strip" | "tall" | "mid" | "shopban";

export interface PlaceholderBannerProps {
  variant?: PlaceholderBannerVariant;
  dotCount?: number;
  activeDot?: number;
  className?: string;
}

const heightClasses: Record<PlaceholderBannerVariant, string> = {
  // 16:5, matching the real hero it stands in for — at 1882/500 the skeleton
  // was a different shape from the banner that replaced it, so the page
  // visibly jumped when the image arrived.
  hero: "aspect-[16/5]",
  strip: "h-[150px]",
  tall: "h-[360px]",
  mid: "h-[300px]",
  shopban: "h-[230px]",
};

export function PlaceholderBanner({
  variant = "hero",
  dotCount = 0,
  activeDot = 0,
  className,
}: PlaceholderBannerProps) {
  return (
    <div
      className={cn(
        "relative rounded-2xl bg-gray",
        heightClasses[variant],
        className,
      )}
    >
      {dotCount > 0 && (
        <div className="absolute bottom-3.5 left-1/2 flex -translate-x-1/2 gap-2">
          {Array.from({ length: dotCount }).map((_, i) => (
            <i
              key={i}
              className={cn(
                "h-[9px] w-[9px] rounded-full",
                i === activeDot ? "bg-[#333]" : "bg-white",
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
