"use client";

import { ReactNode } from "react";
import { cn } from "../lib/cn";
import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface FilterCheckboxOption {
  label: string;
  href: string;
  active: boolean;
  count?: number;
}

export interface FilterCheckboxGroupProps {
  heading: ReactNode;
  options: FilterCheckboxOption[];
  linkComponent?: LinkComponent;
}

const checkIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-2.5 w-2.5">
    <path d="m5 12 5 5 9-11" />
  </svg>
);

// The API only supports one categoryId/tagId at a time, so these render as
// single-select links styled as checkboxes (clicking toggles the filter on/
// off by navigating), not a real multi-select form.
export function FilterCheckboxGroup({ heading, options, linkComponent: Link = DefaultLink }: FilterCheckboxGroupProps) {
  return (
    <div>
      <div className="mb-3.5 flex items-center justify-between font-ui text-[15px] font-semibold text-ink">
        {heading}
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-4 w-4">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>
      {options.map((option) => (
        <Link
          key={option.href}
          href={option.href}
          className="flex items-center gap-2 py-1.5 font-body text-[13.5px] text-ink"
        >
          <span
            className={cn(
              "grid h-[15px] w-[15px] shrink-0 place-items-center rounded-[3px] border",
              option.active ? "border-green bg-green text-white" : "border-line",
            )}
          >
            {option.active && checkIcon}
          </span>
          <span className={cn(option.active && "underline")}>{option.label}</span>
          {option.count !== undefined && (
            <span className="text-xs text-muted">({option.count})</span>
          )}
        </Link>
      ))}
    </div>
  );
}
