"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface NavItemChild {
  key: string;
  label: string;
  href: string;
}

export interface NavItem {
  key: string;
  label: string;
  href: string;
  /** Real sub-category links — the dropdown only renders when this is non-empty. */
  children?: NavItemChild[];
}

export interface NavProps {
  /** Rendered first, always — spec 6.1's static "All Products" entry. */
  allProductsHref: string;
  allProductsLabel: string;
  /** Already in priority order (ascending) — the server query sorts by sortOrder, so array order IS priority order. */
  items: NavItem[];
  activeHref?: string;
  linkComponent?: LinkComponent;
  className?: string;
}

function Chevron({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      className={cn("h-3 w-3 shrink-0 text-white/70 transition-transform duration-150", className)}
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

const linkClass =
  "relative flex h-full items-center gap-1.5 whitespace-nowrap px-4 font-header text-[13.5px] font-semibold text-white transition-colors hover:bg-black/[0.14] focus-visible:outline focus-visible:outline-2 focus-visible:outline-white focus-visible:-outline-offset-2 lg:px-3";
const activeAfterClass =
  "after:absolute after:inset-x-3 after:bottom-0 after:h-[3px] after:rounded-t-[3px] after:bg-gold after:content-['']";
const dropdownPanelClass =
  "invisible absolute left-0 top-full z-40 min-w-[210px] translate-y-1 rounded-b-[10px] border border-header-line bg-white p-2 opacity-0 shadow-[0_14px_30px_rgba(30,43,34,.14)] transition-[opacity,transform] duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100";
const dropdownItemClass = "block rounded-[7px] px-3 py-2.5 font-header text-[13px] font-semibold text-header-ink hover:bg-beige hover:text-header-green";

interface RenderableItem {
  key: string;
  label: string;
  href: string;
  children?: NavItemChild[];
}

export function Nav({ allProductsHref, allProductsLabel, items, activeHref, linkComponent: Link = DefaultLink, className }: NavProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRefs = useRef(new Map<string, HTMLDivElement>());
  const visibleRefs = useRef(new Map<string, HTMLDivElement>());
  const moreMeasureRef = useRef<HTMLDivElement>(null);
  const [forcedOpen, setForcedOpen] = useState<string | null>(null);
  // Dropdowns default left-anchored, but whichever item currently sits near
  // the row's right edge needs to flip right-anchored instead — otherwise a
  // 210px-min-width panel extends past the viewport, and — same bug as the
  // "More" button's panel, fixed earlier — that happens even while closed,
  // since an invisible-but-laid-out panel still counts toward the page's
  // scrollWidth. Which item that is depends on viewport width and real
  // category-name lengths, so it can't be hardcoded to "the last item"
  // (confirmed live: a real category with children landed one slot before
  // "More" at 1100px and overflowed the page by 17px on initial render,
  // before any hover ever happened). A Set, not one key, because resizing
  // can legitimately put more than one item's dropdown at risk at once.
  const [rightAlignKeys, setRightAlignKeys] = useState<Set<string>>(new Set());

  function checkAlignment(key: string, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const overflowsRight = rect.left + 210 > window.innerWidth;
    setRightAlignKeys((current) => {
      const has = current.has(key);
      if (overflowsRight === has) return current;
      const next = new Set(current);
      if (overflowsRight) next.add(key);
      else next.delete(key);
      return next;
    });
  }

  const allItems: RenderableItem[] = [{ key: "__all__", label: allProductsLabel, href: allProductsHref }, ...items];

  // Spec 6.3: server-render the full list (SEO/no hydration mismatch), then
  // collapse to fit after measuring real rendered widths — a one-frame
  // reflow is acceptable. Never shrinks font or wraps; always measures the
  // real "More" button width rather than assuming a fixed size.
  const [visibleCount, setVisibleCount] = useState(allItems.length);

  useEffect(() => {
    function recompute() {
      const container = containerRef.current;
      if (!container) return;
      // clientWidth includes the container's own 24px+24px horizontal
      // padding — using it directly as the fit budget overestimated
      // available space by 48px, letting one extra item's link (not just
      // its dropdown) render past the viewport's right edge before the
      // "More" collapse kicked in (confirmed live: a 17px page overflow at
      // 1100px width, with the offending link's own right edge already past
      // the viewport, independent of any dropdown positioning).
      const cs = getComputedStyle(container);
      const containerWidth = container.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      const widths = allItems.map((item) => measureRefs.current.get(item.key)?.getBoundingClientRect().width ?? 0);
      const total = widths.reduce((sum, w) => sum + w, 0);
      if (total <= containerWidth) {
        setVisibleCount(allItems.length);
        return;
      }
      const moreWidth = moreMeasureRef.current?.getBoundingClientRect().width ?? 0;
      const budget = containerWidth - moreWidth;
      let used = 0;
      let count = 0;
      for (const w of widths) {
        if (used + w > budget) break;
        used += w;
        count++;
      }
      setVisibleCount(count);
    }

    recompute();
    const container = containerRef.current;
    const observer = container ? new ResizeObserver(recompute) : null;
    if (container && observer) observer.observe(container);
    // Bangla category names change width once Noto Sans Bengali finishes
    // swapping in — recompute once that settles.
    document.fonts?.ready.then(recompute).catch(() => {});
    return () => observer?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, allProductsLabel]);

  useEffect(() => {
    if (!forcedOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setForcedOpen(null);
    }
    function handleClickOutside(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setForcedOpen(null);
    }
    document.addEventListener("keydown", handleKey);
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("keydown", handleKey);
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [forcedOpen]);

  const visible = allItems.slice(0, visibleCount);
  const overflowed = allItems.slice(visibleCount);

  // Runs after `visibleCount` settles (so it reads the real, currently-
  // rendered item positions, not the previous layout) and again on resize —
  // this is what catches the overflow on first render/resize, before any
  // hover/focus/click ever fires the same check in checkAlignment() above.
  useEffect(() => {
    function recomputeAlignment() {
      setRightAlignKeys((current) => {
        const next = new Set<string>();
        for (const item of visible) {
          if (!item.children?.length) continue;
          const el = visibleRefs.current.get(item.key);
          if (!el) continue;
          if (el.getBoundingClientRect().left + 210 > window.innerWidth) next.add(item.key);
        }
        if (next.size === current.size && [...next].every((k) => current.has(k))) return current;
        return next;
      });
    }
    recomputeAlignment();
    window.addEventListener("resize", recomputeAlignment);
    return () => window.removeEventListener("resize", recomputeAlignment);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleCount]);

  function renderItem(item: RenderableItem, forMeasuring = false) {
    const hasChildren = !!item.children?.length;
    const isActive = activeHref === item.href;
    const isForced = forcedOpen === item.key;
    return (
      <div
        key={item.key}
        ref={(el: HTMLDivElement | null) => {
          const map = forMeasuring ? measureRefs.current : visibleRefs.current;
          if (el) map.set(item.key, el);
          else map.delete(item.key);
        }}
        className="group relative flex items-stretch"
        onMouseEnter={hasChildren ? (e) => checkAlignment(item.key, e.currentTarget) : undefined}
        onFocusCapture={hasChildren ? (e) => checkAlignment(item.key, e.currentTarget) : undefined}
      >
        <Link
          href={item.href}
          className={cn(linkClass, isActive && cn("bg-black/[0.18]", activeAfterClass))}
          aria-haspopup={hasChildren || undefined}
          aria-expanded={hasChildren ? isForced : undefined}
        >
          {item.label}
          {hasChildren && (
            <button
              type="button"
              tabIndex={-1}
              aria-hidden
              onClick={(e) => {
                e.preventDefault();
                checkAlignment(item.key, e.currentTarget.closest(".group") as HTMLElement);
                setForcedOpen((current) => (current === item.key ? null : item.key));
              }}
              className="grid h-4 w-4 place-items-center"
            >
              <Chevron className={isForced ? "rotate-180" : "group-hover:rotate-180 group-focus-within:rotate-180"} />
            </button>
          )}
        </Link>
        {hasChildren && (
          <div
            className={cn(dropdownPanelClass, rightAlignKeys.has(item.key) && "left-auto right-0", isForced && "visible translate-y-0 opacity-100")}
            role="menu"
          >
            {item.children!.map((child) => (
              <Link key={child.key} href={child.href} className={dropdownItemClass}>
                {child.label}
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <nav className={cn("hidden bg-header-green md:block", className)}>
      <div ref={containerRef} className="relative mx-auto flex h-[52px] w-full max-w-[1440px] items-stretch px-6">
        {visible.map((item) => renderItem(item))}
        {overflowed.length > 0 && (
          <div className="group relative flex items-stretch">
            <button
              type="button"
              onClick={() => setForcedOpen((current) => (current === "__more__" ? null : "__more__"))}
              aria-haspopup
              aria-expanded={forcedOpen === "__more__"}
              className={linkClass}
            >
              More
              <Chevron className={forcedOpen === "__more__" ? "rotate-180" : "group-hover:rotate-180 group-focus-within:rotate-180"} />
            </button>
            {/* Right-anchored (left-auto/right-0 overriding the shared
                dropdownPanelClass's left-0): "More" is always the trailing
                item, sitting near the row's right edge — a left-anchored
                210px panel from there extends past the viewport. Confirmed
                live: even while closed, visibility:hidden content is still
                laid out and was inflating the page's scrollWidth at
                768-1280px, forcing a real horizontal scrollbar. */}
            <div
              className={cn(dropdownPanelClass, "left-auto right-0", forcedOpen === "__more__" && "visible translate-y-0 opacity-100")}
              role="menu"
            >
              {overflowed.map((item) => (
                <div key={item.key}>
                  <Link href={item.href} className={dropdownItemClass}>
                    {item.label}
                  </Link>
                  {!!item.children?.length && (
                    <div className="ml-3 border-l border-header-line pl-2">
                      {item.children.map((child) => (
                        <Link key={child.key} href={child.href} className={cn(dropdownItemClass, "text-[12.5px] font-medium")}>
                          {child.label}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Off-screen measuring pass — same markup/classes as the real items
            (including the More button) so widths are exact, never display:none
            (that would report 0 width). `fixed` positioning (not `absolute`)
            is required here, not just visual polish: an `absolute` child
            still inflates its nearest positioned ancestor's *scroll* width
            even while invisible, which — since this row's own `.group`
            wrappers can't have `overflow-hidden` (that would clip the
            dropdown panels, which intentionally extend below the row) —
            bubbled all the way up to a real page-level horizontal scrollbar
            at 768-1024px (confirmed live). `fixed` at a huge negative offset
            is measured relative to the viewport, not this container, so it
            never contributes to anything's scrollWidth. */}
        <div className="pointer-events-none invisible fixed left-[-9999px] top-0 flex" aria-hidden>
          {allItems.map((item) => renderItem(item, true))}
          <div ref={moreMeasureRef} className={linkClass}>
            More
            <Chevron />
          </div>
        </div>
      </div>
    </nav>
  );
}
