"use client";

import { useEffect, useState } from "react";

export interface WatchingNowBadgeProps {
  productId: number;
  className?: string;
}

const eyeIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.8}>
    <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// No real live-viewer tracking exists in this codebase yet (would need a
// presence/heartbeat backend). This is the hook point for it: once a real
// per-product "currently watching" count is ever written to a cookie or the
// session, read it here instead. Until then this always returns undefined,
// so the caller falls through to the random fallback below.
function getRealWatchingCount(_productId: number): number | undefined {
  return undefined;
}

// Random, regenerated on every mount/refresh — only used when no real count
// is available (see getRealWatchingCount above). Deliberately NOT rendered
// during SSR (starts null) since Math.random() would differ between server
// and client and trigger a hydration mismatch.
export function WatchingNowBadge({ productId, className }: WatchingNowBadgeProps) {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const real = getRealWatchingCount(productId);
    setCount(real ?? Math.floor(Math.random() * 35) + 1);
  }, [productId]);

  if (count === null) return null;

  return (
    <div className={`mb-5 flex items-center gap-2 rounded-[10px] bg-[#e9e9e7] px-4 py-3 font-ui text-sm text-ink ${className ?? ""}`}>
      <span className="text-green">{eyeIcon}</span>
      {count} People watching this product now!
    </div>
  );
}
