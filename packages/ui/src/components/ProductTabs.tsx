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
    <div className={cn("border-t border-line pt-5.5", className)}>
      <div role="tablist" className="mb-4 flex flex-wrap gap-6 border-b border-line">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === activeTab.id}
            onClick={() => setActive(tab.id)}
            className={cn(
              "-mb-px border-b-2 pb-3 font-ui text-sm font-medium",
              tab.id === activeTab.id ? "border-green text-ink" : "border-transparent text-muted",
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
