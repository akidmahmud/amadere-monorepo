"use client";

import { cn } from "../lib/cn";

export interface CollectionTabOption {
  key: string;
  label: string;
}

export interface CollectionTabsProps {
  options: CollectionTabOption[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

// justify-start on narrow screens, centered only once it reliably fits —
// justify-center combined with overflow-x-auto clips the start of the list
// at initial scroll position when it overflows (same trap fixed on the site
// Nav; documented so nobody reintroduces it here).
export function CollectionTabs({ options, activeKey, onChange, className }: CollectionTabsProps) {
  if (options.length === 0) return null;

  return (
    <div
      className={cn(
        "flex justify-start gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:justify-center [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.key}
          type="button"
          onClick={() => onChange(option.key)}
          className={cn(
            "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 font-ui text-sm font-medium transition-colors",
            option.key === activeKey
              ? "border-green bg-green text-white"
              : "border-line bg-white text-ink hover:border-green hover:text-green",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
