"use client";

import { cn } from "../lib/cn";

export interface TabOption {
  value: string;
  label: string;
}

export interface TabsProps {
  options: TabOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// §5.11 — in-card segmented tabs (e.g. "All / Revenue / Expenses"), distinct
// from the sidebar nav. Underline indicator, not a pill.
export function Tabs({ options, value, onChange, className }: TabsProps) {
  return (
    <div className={cn("flex gap-[22px] border-b border-border", className)}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "-mb-px border-b-2 border-transparent pb-2.5 font-ui text-sm text-muted transition-colors duration-150",
            option.value === value && "border-brand-500 font-semibold text-text",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
