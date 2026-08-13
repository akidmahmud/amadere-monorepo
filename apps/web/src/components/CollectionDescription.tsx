"use client";

import { useEffect, useRef, useState } from "react";

// Clamps to 4 lines with a "See more"/"See less" toggle, on both mobile and
// desktop — long collection/category descriptions were running the full,
// unclamped length, eating a lot of vertical space above the fold before any
// products were visible. The toggle only renders once the text actually
// overflows 4 lines — a short description that already fits needs nothing
// to click. `html` renders admin-authored WYSIWYG content (already
// sanitized by the caller, same as the category page did before this);
// plain collection descriptions render as text.
export function CollectionDescription({
  description,
  html = false,
  className = "",
}: {
  description: string;
  html?: boolean;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflowing(el.scrollHeight > el.clientHeight + 1);
  }, []);

  const clampClassName = `max-w-2xl font-body text-sm text-muted ${className} ${expanded ? "" : "line-clamp-4"}`;

  return (
    <div>
      {html ? (
        // eslint-disable-next-line react/no-danger
        <div ref={ref} className={clampClassName} dangerouslySetInnerHTML={{ __html: description }} />
      ) : (
        <p ref={ref} className={clampClassName}>
          {description}
        </p>
      )}
      {overflowing && (
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="mt-1 font-ui text-xs font-semibold text-green"
        >
          {expanded ? "See less" : "See more"}
        </button>
      )}
    </div>
  );
}
