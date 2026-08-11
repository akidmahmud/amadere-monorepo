"use client";

import * as RadixSelect from "@radix-ui/react-select";
import { ReactNode } from "react";
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
  ...aria
}: SelectProps): ReactNode {
  return (
    <RadixSelect.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={onValueChange}
      disabled={disabled}
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
          <RadixSelect.ScrollUpButton className="flex items-center justify-center py-1 text-muted">
            {chevronUp}
          </RadixSelect.ScrollUpButton>
          <RadixSelect.Viewport className="p-1">
            {options.map((option) => (
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
