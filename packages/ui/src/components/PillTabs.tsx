"use client";

import { cn } from "../lib/cn";

export interface PillTabOption {
  value: string;
  label: string;
}

export interface PillTabsProps {
  options: PillTabOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function PillTabs({ options, value, onChange, className }: PillTabsProps) {
  return (
    <div
      role="tablist"
      className={cn("mb-6 flex flex-wrap justify-center gap-2.5", className)}
    >
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "whitespace-nowrap rounded-full border px-[17px] py-2 font-ui text-sm font-medium transition-colors",
              active
                ? "border-green bg-green text-white"
                : "border-line bg-white text-ink hover:border-green hover:text-green",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
