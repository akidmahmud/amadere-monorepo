"use client";

import { cn } from "../lib/cn";

export interface QtyStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  variant?: "green" | "gold";
  disabled?: boolean;
  className?: string;
}

const variantClasses = {
  green: "text-green",
  gold: "text-gold-dark",
};

export function QtyStepper({
  value,
  onChange,
  min = 1,
  max,
  variant = "green",
  disabled,
  className,
}: QtyStepperProps) {
  const canDecrement = !disabled && value > min;
  const canIncrement = !disabled && (max === undefined || value < max);

  return (
    <div
      className={cn(
        "inline-flex items-center overflow-hidden rounded-[8px] border border-line",
        className,
      )}
    >
      <button
        type="button"
        aria-label="Decrease quantity"
        disabled={!canDecrement}
        onClick={() => onChange(value - 1)}
        className={cn(
          "grid h-[26px] w-[26px] place-items-center text-base disabled:opacity-40",
          variantClasses[variant],
        )}
      >
        –
      </button>
      <span className="min-w-[30px] text-center font-ui text-sm">{value}</span>
      <button
        type="button"
        aria-label="Increase quantity"
        disabled={!canIncrement}
        onClick={() => onChange(value + 1)}
        className={cn(
          "grid h-[26px] w-[26px] place-items-center text-base disabled:opacity-40",
          variantClasses[variant],
        )}
      >
        +
      </button>
    </div>
  );
}
