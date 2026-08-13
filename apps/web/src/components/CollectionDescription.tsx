"use client";

import { useEffect, useRef, useState } from "react";

// Mobile only: clamps to 4 lines with a "See more"/"See less" toggle — long
// collection descriptions were running the full, unclamped length on every
// screen size, which ate a lot of vertical space above the fold on mobile
// before any products were visible. Desktop keeps showing the full text
// (never clamped there), matching the explicit "in mobile version" scope.
// The toggle only renders once the text actually overflows 4 lines — a
// short description that already fits needs nothing to click.
export function CollectionDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, []);

  return (
    <div>
      <p ref={ref} className={`max-w-2xl font-body text-sm text-muted ${expanded ? "" : "max-md:line-clamp-4"}`}>
        {description}
      </p>
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 font-ui text-xs font-semibold text-green md:hidden"
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  );
}
