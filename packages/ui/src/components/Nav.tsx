"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface NavItem {
  key: string;
  label: string;
  href: string;
  hasChildren?: boolean;
  /** Optional small icon rendered before the label (e.g. a per-collection glyph). */
  icon?: ReactNode;
}

export interface NavProps {
  items: NavItem[];
  activeHref?: string;
  linkComponent?: LinkComponent;
  className?: string;
}

const chevron = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-[11px] w-[11px]">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

export function Nav({ items, activeHref, linkComponent: Link = DefaultLink, className }: NavProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  // Same fit-vs-overflow measurement Carousel.tsx uses: centering an
  // overflowing nowrap row clips its start (scrollLeft starts at 0, which
  // sits mid-content once centered), so centering is only safe once we know
  // the row actually fits. Overflowing falls back to left-aligned +
  // scrollable instead of the old flex-wrap 2-line layout that didn't match
  // the single-line desktop look.
  const [hasOverflow, setHasOverflow] = useState(false);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const update = () => setHasOverflow(row.scrollWidth > row.clientWidth + 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(row);
    return () => observer.disconnect();
  }, [items]);

  return (
    <nav
      id="site-nav-row"
      className={cn(
        // Sticks right below Header (which is `sticky top-0 h-32` on
        // desktop, the only breakpoint this row shows at) — top-32 matches
        // that height so this row stacks under it instead of overlapping;
        // z-30 keeps it below Header's z-40 so Header stays on top while
        // both are pinned.
        "hidden border-b border-line bg-[#1F703C] sm:sticky sm:top-32 sm:z-30 sm:block",
        className,
      )}
    >
      {/* flex-nowrap (not flex-wrap) at every width this row shows at: the
          old flex-wrap dropped to a cramped 2-line row (or, once switched to
          nowrap, silently ran the last couple items off the end of the row)
          on laptop screens. Full spacing/icon size only comes back at a
          genuinely wide 1700px+ (an arbitrary breakpoint, not Tailwind's
          2xl=1536px — several real laptop panels report exactly 1536 or
          1440px, so the compact tier has to cover those too, not stop at
          2xl). Below 1700px stays compact enough that all 11 items fit
          without needing the scroll fallback at any common laptop width. */}
      <div
        ref={rowRef}
        className={cn(
          "flex w-full items-center gap-x-1.5 overflow-x-auto whitespace-nowrap px-3 py-3 [scrollbar-width:none] min-[1700px]:gap-x-6 min-[1700px]:px-10 min-[1700px]:py-5 [&::-webkit-scrollbar]:hidden",
          hasOverflow ? "justify-start" : "justify-center",
        )}
      >
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "flex items-center gap-1 whitespace-nowrap font-ui text-[11.5px] font-medium text-white hover:text-[#E7C22D] min-[1700px]:gap-1.5 min-[1700px]:text-[13.5px]",
              activeHref === item.href && "font-semibold text-[#E7C22D]",
            )}
          >
            {item.icon}
            {item.label}
            {item.hasChildren && chevron}
          </Link>
        ))}
      </div>
    </nav>
  );
}
