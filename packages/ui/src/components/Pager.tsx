"use client";

import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface PagerProps {
  page: number;
  totalPages: number;
  buildHref: (page: number) => string;
  linkComponent?: LinkComponent;
}

// Real links to `buildHref(n)`, not client-side state — pagination stays a
// plain server-rendered navigation like the rest of the catalog (§7).
export function Pager({ page, totalPages, buildHref, linkComponent: Link = DefaultLink }: PagerProps) {
  if (totalPages <= 1) return null;

  const windowSize = 5;
  const start = Math.max(1, Math.min(page - Math.floor(windowSize / 2), totalPages - windowSize + 1));
  const pages = Array.from({ length: Math.min(windowSize, totalPages) }, (_, i) => start + i);

  return (
    <div className="mt-8 flex justify-center gap-2">
      {pages.map((n) => (
        <Link
          key={n}
          href={buildHref(n)}
          className={cn(
            "grid h-[38px] w-[38px] place-items-center rounded-[9px] border font-ui text-sm font-semibold",
            n === page ? "border-green bg-green text-white" : "border-line bg-white text-ink",
          )}
        >
          {n}
        </Link>
      ))}
      {page < totalPages && (
        <Link
          href={buildHref(page + 1)}
          aria-label="Next page"
          className="grid h-[38px] w-[38px] place-items-center rounded-[9px] border border-line bg-white text-ink"
        >
          →
        </Link>
      )}
    </div>
  );
}
