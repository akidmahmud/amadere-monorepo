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
  /** "pill" is a Net Profit / WPFOK-parity variant (violet gradient active pill) — omit for the default §5.11 underline tabs used elsewhere. */
  variant?: "underline" | "pill";
}

// §5.11 — in-card segmented tabs (e.g. "All / Revenue / Expenses"), distinct
// from the sidebar nav. Underline indicator, not a pill, by default.
export function Tabs({ options, value, onChange, className, variant = "underline" }: TabsProps) {
  if (variant === "pill") {
    return (
      <div className={cn("flex flex-wrap gap-2.5", className)}>
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            className={cn(
              "rounded-sm border border-border bg-surface px-4 py-2.5 font-ui text-sm font-semibold text-secondary transition-colors duration-150",
              option.value === value && "border-transparent text-white shadow-pop",
            )}
            style={
              option.value === value
                ? { background: "linear-gradient(135deg, var(--brand-500), var(--brand-400))" }
                : undefined
            }
          >
            {option.label}
          </button>
        ))}
      </div>
    );
  }

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
