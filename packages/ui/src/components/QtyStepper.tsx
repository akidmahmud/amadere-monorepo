"use client";

import { cn } from "../lib/cn";

export interface QtyStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  className?: string;
}

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max,
  disabled,
  className,
}: QtyStepperProps) {
  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && (max === undefined || value < max);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-[#eef0f3] p-1",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={!canDecrement}
        onClick={() => onChange(value - 1)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-base text-[#8a94a3] disabled:opacity-40"
      >
        –
      </button>
      <span className="min-w-[22px] text-center font-ui text-sm font-semibold text-[#2f5fdb]">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={!canIncrement}
        onClick={() => onChange(value + 1)}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-base text-[#8a94a3] disabled:opacity-40"
      >
        +
      </button>
    </div>
  );
}
