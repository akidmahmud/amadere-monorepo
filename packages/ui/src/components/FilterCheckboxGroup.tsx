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
  /** Renders as a native <details>/<summary> instead of an always-open div —
   * pixel-matched to ghorerbazar.com's collapsible sidebar widgets. */
  collapsible?: boolean;
  defaultOpen?: boolean;
}

const chevronIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-3.5 w-3.5">
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// Pixel-matched to ghorerbazar.com's sidebar facet widgets (`.widget-title`):
// uppercase 13px/700 heading with a green underline sized to the text itself
// (their orange, replaced with Amader's own green) plus a full-width light
// divider below the title row, +/- collapse via native <details>.
export function FilterCheckboxGroup({
  heading,
  options,
  linkComponent: Link = DefaultLink,
  collapsible,
  defaultOpen = true,
}: FilterCheckboxGroupProps) {
  const titleRow = (
    <>
      <span className="inline-block border-b-2 border-header-green pb-[10px] font-ui text-[13px] font-bold uppercase tracking-[0.06em] text-ink">
        {heading}
      </span>
      <span className="shrink-0 transition-transform group-open:rotate-180">{chevronIcon}</span>
    </>
  );

  const list = options.map((option) => (
    <Link
      key={option.href}
      href={option.href}
      scroll={false}
      className="flex items-center gap-2 py-1.5 font-body text-[13.5px] text-ink"
    >
      <span
        className={cn(
          "grid h-4 w-4 shrink-0 place-items-center rounded-[4px] border",
          option.active ? "border-header-green bg-header-green text-white" : "border-line",
        )}
      >
        {option.active && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-2.5 w-2.5">
            <path d="m5 12 5 5 9-11" />
          </svg>
        )}
      </span>
      <span className={cn(option.active && "underline")}>{option.label}</span>
      {option.count !== undefined && <span className="text-xs text-muted">({option.count})</span>}
    </Link>
  ));

  if (collapsible) {
    return (
      <details className="group" open={defaultOpen}>
        <summary className="mb-3 flex cursor-pointer list-none items-end justify-between border-b border-line pb-3.5 text-header-green [&::-webkit-details-marker]:hidden">
          {titleRow}
        </summary>
        {list}
      </details>
    );
  }

  return (
    <div>
      <div className="mb-3 flex items-end justify-between border-b border-line pb-3.5 text-header-green">
        {titleRow}
      </div>
      {list}
    </div>
  );
}
