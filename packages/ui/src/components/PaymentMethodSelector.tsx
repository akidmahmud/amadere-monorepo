"use client";

import { cn } from "../lib/cn";

export interface PaymentMethodOption {
  value: string;
  label: string;
  disabledLabel?: string;
}

export interface PaymentMethodSelectorProps {
  options: PaymentMethodOption[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

const checkIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="h-2.5 w-2.5">
    <path d="m5 12 5 5 9-11" />
  </svg>
);

export function PaymentMethodSelector({ options, value, onChange, className }: PaymentMethodSelectorProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3", className)}>
      {options.map((option) => {
        const disabled = Boolean(option.disabledLabel);
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center gap-2.5 rounded-[10px] border-[1.5px] p-3 text-left font-ui text-[13.5px]",
              active ? "border-green" : "border-line",
              disabled && "cursor-not-allowed opacity-50",
            )}
          >
            <span className="h-[30px] w-[30px] shrink-0 rounded-md bg-[#D9D9D9]" />
            <span className="flex-1">
              {option.label}
              {option.disabledLabel && (
                <span className="block text-xs text-muted">{option.disabledLabel}</span>
              )}
            </span>
            {active && (
              <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full bg-green text-white">
                {checkIcon}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
