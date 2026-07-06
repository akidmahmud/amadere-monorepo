"use client";

import * as RadixCheckbox from "@radix-ui/react-checkbox";
import { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface CheckboxProps {
  checked?: boolean;
  defaultChecked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
  label?: ReactNode;
  id?: string;
  className?: string;
}

const check = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-3 w-3">
    <path d="m5 13 4 4L19 7" />
  </svg>
);

export function Checkbox({
  checked,
  defaultChecked,
  onCheckedChange,
  disabled,
  label,
  id,
  className,
}: CheckboxProps) {
  const box = (
    <RadixCheckbox.Root
      id={id}
      checked={checked}
      defaultChecked={defaultChecked}
      onCheckedChange={(state) => onCheckedChange?.(state === true)}
      disabled={disabled}
      className={cn(
        "flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[4px] border border-line bg-white data-[state=checked]:border-green data-[state=checked]:bg-green data-[state=checked]:text-white",
        className,
      )}
    >
      <RadixCheckbox.Indicator>{check}</RadixCheckbox.Indicator>
    </RadixCheckbox.Root>
  );

  if (!label) return box;

  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-2 font-body text-sm text-ink"
    >
      {box}
      {label}
    </label>
  );
}
