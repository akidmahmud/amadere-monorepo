"use client";

import { useEffect, useState } from "react";

export interface WatchingNowBadgeProps {
  productId: number;
  salesCount?: number;
  className?: string;
}

const eyeIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const shoppingBagIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
    <line x1="3" y1="6" x2="21" y2="6" />
    <path d="M16 10a4 4 0 0 1-8 0" />
  </svg>
);

function getRealWatchingCount(_productId: number): number | undefined {
  return undefined;
}

export function WatchingNowBadge({ productId, salesCount, className }: WatchingNowBadgeProps) {
  const [watchingCount, setWatchingCount] = useState<number | null>(null);
  const [boughtCount, setBoughtCount] = useState<number | null>(null);

  useEffect(() => {
    const realWatching = getRealWatchingCount(productId);
    setWatchingCount(realWatching ?? Math.floor(Math.random() * 25) + 15);

    if (typeof salesCount === "number") {
      setBoughtCount(salesCount);
    } else {
      setBoughtCount(0);
    }
  }, [productId, salesCount]);

  if (watchingCount === null || boughtCount === null) return null;

  return (
    <div
      className={`mb-5 inline-flex max-w-full flex-wrap items-center gap-x-3.5 gap-y-1.5 rounded-[10px] bg-[#E9E9E7] px-5 py-3 font-ui text-sm text-ink ${
        className ?? ""
      }`}
    >
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-green">{eyeIcon}</span>
        <span>
          <strong className="font-semibold">{watchingCount}</strong> People watching
        </span>
      </div>
      <span className="text-muted/60">•</span>
      <div className="flex items-center gap-2 whitespace-nowrap">
        <span className="text-green">{shoppingBagIcon}</span>
        <span>
          <strong className="font-semibold">{boughtCount}</strong> People bought
        </span>
      </div>
    </div>
  );
}
