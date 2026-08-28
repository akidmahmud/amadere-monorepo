"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { cn } from "../lib/cn";

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  options: SelectOption[];
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  placeholder?: string;
  variant?: "bordered" | "plain";
  disabled?: boolean;
  "aria-label"?: string;
  className?: string;
  /**
   * Show a filter box at the top of the list. Worth it past ~20 options —
   * the district field has 64, where scrolling to find one is the slowest
   * part of the checkout form.
   */
  searchable?: boolean;
  /** Placeholder for the filter box. */
  searchPlaceholder?: string;
}

const chevron = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-3 w-3">
    <path d="m6 9 6 6 6-6" />
  </svg>
);
const chevronUp = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-3 w-3">
    <path d="m18 15-6-6-6 6" />
  </svg>
);

export function Select({
  options,
  value,
  defaultValue,
  onValueChange,
  placeholder,
  variant = "bordered",
  disabled,
  className,
  searchable = false,
  searchPlaceholder = "Search…",
  ...aria
}: SelectProps): ReactNode {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // Radix Select focuses the option list itself on open, and its Content has
  // no onOpenAutoFocus to intercept (that is Popover/Dropdown). Focusing on
  // the next frame lands after Radix is done, so typing works immediately
  // instead of needing a click into the box first.
  useEffect(() => {
    if (!open || !searchable) return;
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open, searchable]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    const matches = options.filter((o) => o.label.toLowerCase().includes(q));
    // The selected option stays mounted even when it does not match. Radix
    // reads the trigger's display text from the Item with that value, so
    // filtering it out of the list blanks the closed trigger mid-typing.
    const selected = options.find((o) => o.value === value);
    return selected && !matches.some((o) => o.value === selected.value)
      ? [selected, ...matches]
      : matches;
  }, [options, query, value]);

  return (
    <RadixSelect.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
      // Reset on close so reopening never starts inside a stale filter.
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setQuery("");
      }}
    >
      <RadixSelect.Trigger
        aria-label={aria["aria-label"]}
        className={cn(
          "flex items-center justify-between gap-2 font-body text-sm text-ink outline-none",
          variant === "bordered"
            ? "w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 focus:border-green"
            : "cursor-pointer border-none bg-transparent font-serif text-sm text-ink",
          disabled && "cursor-not-allowed opacity-50",
          className,
        )}
      >
        <RadixSelect.Value placeholder={placeholder} />
        <RadixSelect.Icon>{chevron}</RadixSelect.Icon>
      </RadixSelect.Trigger>
      <RadixSelect.Portal>
        <RadixSelect.Content
          className="overflow-hidden rounded-[10px] border border-line bg-white shadow-brand"
          position="popper"
          sideOffset={4}
          // Radix exposes --radix-select-content-available-height but
          // doesn't apply it for you — without a real max-height, Content
          // (and the district dropdown specifically, once it went from a
          // ~10-item division-gated list to the full 64-district list) just
          // renders at its natural full height instead of scrolling, with
          // whatever doesn't fit silently clipped by overflow-hidden above
          // rather than reachable. Capped at 300px (not just the raw
          // available height) per explicit request — the available-height
          // value alone could still stretch to ~590px on a tall screen,
          // showing nearly the whole district list at once instead of a
          // normal-sized scrollable dropdown.
          style={{ maxHeight: "min(var(--radix-select-content-available-height), 300px)" }}
        >
          {searchable && (
            <div className="border-b border-line p-2">
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="w-full rounded-[8px] border border-line bg-white px-2.5 py-1.5 font-body text-sm text-ink outline-none focus:border-green"
                // Radix Select runs its own typeahead on keydown and moves
                // focus to the matching item, so without this every letter
                // typed here jumps the list and pulls focus out of the box.
                // Arrow keys and Enter are deliberately NOT stopped, so the
                // keyboard can still move into and pick from the list.
                onKeyDown={(e) => {
                  if (!["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"].includes(e.key)) {
                    e.stopPropagation();
                  }
                }}
              />
            </div>
          )}
          <RadixSelect.ScrollUpButton className="flex items-center justify-center py-1 text-muted">
            {chevronUp}
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="p-1">
            {searchable && filtered.length === 0 && (
              <p className="px-3 py-4 text-center font-body text-sm text-muted">No matches</p>
            )}
            {(searchable ? filtered : options).map((option) => (
              <RadixSelect.Item
                key={option.value}
                value={option.value}
                className="cursor-pointer rounded-md px-3 py-2 font-body text-sm text-ink outline-none data-[highlighted]:bg-cream data-[state=checked]:text-green"
              >
                <RadixSelect.ItemText>{option.label}</RadixSelect.ItemText>
              </RadixSelect.Item>
            ))}
          </RadixSelect.Viewport>
          <RadixSelect.ScrollDownButton className="flex items-center justify-center py-1 text-muted">
            {chevron}
          </RadixSelect.ScrollDownButton>
        </RadixSelect.Content>
      </RadixSelect.Portal>
    </RadixSelect.Root>
  );
}
