"use client";

import { ReactNode, useState } from "react";
import { cn } from "../lib/cn";

export interface ProductTab {
  id: string;
  label: string;
  content: ReactNode;
}

export interface ProductTabsProps {
  tabs: ProductTab[];
  className?: string;
}

export function ProductTabs({ tabs, className }: ProductTabsProps) {
  const [active, setActive] = useState(tabs[0]?.id);
  if (tabs.length === 0) return null;
  const activeTab = tabs.find((t) => t.id === active) ?? tabs[0];

  return (
    <div className={cn(className)}>
      {/* Single scrollable row rather than flex-wrap — with 4-5 tabs, wrapping
          produces an uneven last row on narrow screens (e.g. one lone pill on
          its own line). A horizontal scroller keeps every screen size to one
          tidy row, matching how this pattern is usually handled on mobile. */}
      <div role="tablist" className="mb-4 flex gap-2 overflow-x-auto [scrollbar-width:none] sm:gap-3 [&::-webkit-scrollbar]:hidden">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded px-4 py-2 font-['Open_Sans',sans-serif] text-xs font-semibold capitalize sm:px-6 sm:py-3 sm:text-sm",
              tab.id === activeTab.id ? "bg-green text-white" : "bg-[#F5F5F5] text-[#666666]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="font-body text-sm leading-relaxed text-ink">
        {activeTab.content}
      </div>
    </div>
  );
}
