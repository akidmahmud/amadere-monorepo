"use client";

import { useEffect, useState } from "react";
import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface AnnouncementItem {
  id: number;
  message: string;
  linkUrl?: string | null;
}

export interface AnnouncementBarProps {
  items: AnnouncementItem[];
  /** Only relevant with 2+ announcements — how often it auto-advances. */
  autoplayMs?: number;
  linkComponent?: LinkComponent;
}

// Always visible while any active announcement exists — no dismiss control.
// Auto-advances through multiple messages the same way AdBannerSection does
// (a plain setInterval, dot-free — there's nothing to click to jump to a
// specific message, matching the reference design's plain rotating text).
export function AnnouncementBar({ items, autoplayMs = 4000, linkComponent: Link = DefaultLink }: AnnouncementBarProps) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % items.length), autoplayMs);
    return () => clearInterval(timer);
  }, [items.length, autoplayMs]);

  if (items.length === 0) return null;

  const current = items[Math.min(index, items.length - 1)];
  const content = <p className="font-ui text-[13px] font-medium text-white">{current.message}</p>;

  return (
    <div className="flex h-9 w-full items-center justify-center bg-green px-5">
      {current.linkUrl ? (
        <Link href={current.linkUrl} className="hover:underline">
          {content}
        </Link>
      ) : (
        content
      )}
    </div>
  );
}
