"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";

export interface ProductTab {
  id: string;
  label: string;
  content: ReactNode;
  /**
   * Turns this tab into a jump-link instead of a content switch: clicking it
   * scrolls to the element with this id (e.g. a "Reviews" tab that jumps to
   * the page's own review section further down) rather than showing
   * `content` here. A plain id string, not an onClick function, because
   * tabs are typically built in a Server Component and functions can't
   * cross that boundary as props — only serializable values like this can.
   */
  scrollTargetId?: string;
}

export interface ProductTabsProps {
  tabs: ProductTab[];
  extraRight?: ReactNode;
  className?: string;
}

function ExpandableContent({ children, maxCollapsedHeight = 200 }: { children: ReactNode; maxCollapsedHeight?: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    const checkHeight = () => {
      if (el.scrollHeight > maxCollapsedHeight + 20) {
        setCanExpand(true);
      } else {
        setCanExpand(false);
      }
    };

    checkHeight();
    const timer = setTimeout(checkHeight, 100);
    const observer = new ResizeObserver(checkHeight);
    observer.observe(el);
    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [maxCollapsedHeight, children]);

  return (
    <div>
      <div
        ref={contentRef}
        className={cn(
          "relative transition-[max-height] duration-300 ease-in-out",
          canExpand && !isExpanded ? "overflow-hidden" : "",
        )}
        style={{ maxHeight: canExpand && !isExpanded ? `${maxCollapsedHeight}px` : "none" }}
      >
        {children}
        {canExpand && !isExpanded && (
          <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-white via-white/80 to-transparent pointer-events-none" />
        )}
      </div>

      {canExpand && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="inline-flex items-center gap-1.5 rounded border border-[#e5e7eb] bg-white px-3.5 py-1.5 font-ui text-xs font-bold text-green hover:border-green hover:bg-beige/40 transition-colors"
          >
            <span>{isExpanded ? "Show less" : "Show more"}</span>
            <svg
              viewBox="0 0 24 24"
              width="12"
              height="12"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              className={cn("transition-transform duration-200", isExpanded ? "rotate-180" : "")}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

export function ProductTabs({ tabs, extraRight, className }: ProductTabsProps) {
  const [active, setActive] = useState(tabs[0]?.id);
  if (tabs.length === 0) return null;
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className={cn(className)}>
      {/* Single scrollable row with optional right element */}
      <div className="mb-4 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
        <div role="tablist" className="flex gap-2 overflow-x-auto [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden flex-1 min-w-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={!tab.scrollTargetId && tab.id === activeTab.id}
              onClick={() => {
                if (tab.scrollTargetId) {
                  document.getElementById(tab.scrollTargetId)?.scrollIntoView({ behavior: "smooth" });
                  return;
                }
                setActive(tab.id);
              }}
              className={cn(
                "shrink-0 whitespace-nowrap rounded px-4 py-2 font-ui text-xs font-semibold capitalize sm:px-6 sm:py-3 sm:text-sm",
                !tab.scrollTargetId && tab.id === activeTab.id ? "bg-green text-white" : "bg-[#F5F5F5] text-[#666666]",
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {extraRight && <div className="shrink-0 font-ui text-sm">{extraRight}</div>}
      </div>
      <div className="font-body text-sm leading-relaxed text-ink">
        <ExpandableContent key={activeTab.id}>{activeTab.content}</ExpandableContent>
      </div>
    </div>
  );
}
