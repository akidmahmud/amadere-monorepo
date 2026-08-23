"use client";

import { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface PaymentMethodOption {
  value: string;
  label: string;
  disabledLabel?: string;
  icon?: ReactNode;
  iconUrl?: string;
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

const METHOD_ICONS: Record<string, ReactNode> = {
  COD: (
    <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-[#008400]/10 text-[#008400]">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="2" y="6" width="20" height="12" rx="2" />
        <circle cx="12" cy="12" r="3" />
        <path d="M6 12h.01M18 12h.01" />
      </svg>
    </div>
  ),
  BKASH: (
    <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-[#E2136E] text-white shadow-sm">
      <svg viewBox="0 0 100 100" fill="currentColor" className="h-5 w-5">
        <path d="M15 80L45 20L65 55L35 80H15Z" fill="white" />
        <path d="M45 20L85 45L65 55L45 20Z" fill="white" opacity="0.85" />
        <path d="M65 55L85 45L75 80L65 55Z" fill="white" opacity="0.7" />
      </svg>
    </div>
  ),
  NAGAD: (
    <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-[#F7921E] to-[#E31219] text-white shadow-sm">
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14.5h-2v-5h2v5zm.5-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1zm3.5 7h-2v-5h2v5zm.5-7c-.55 0-1-.45-1-1s.45-1 1-1 1 .45 1 1-.45 1-1 1z" />
      </svg>
    </div>
  ),
  ROCKET: (
    <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-[#8C3494] text-white shadow-sm">
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 2.5s-4 4-4 9.5c0 3.04 1.5 5.5 4 6.5 2.5-1 4-3.46 4-6.5 0-5.5-4-9.5-4-9.5zm0 11.5c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z" />
      </svg>
    </div>
  ),
  UPAY: (
    <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-[#004B99] text-[#FFD100] shadow-sm">
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
        <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.8L17.5 8 12 11.2 6.5 8 12 4.8zM6 9.8l5 2.9v5.7l-5-3.1V9.8zm12 5.5l-5 3.1v-5.7l5-2.9v5.5z" />
      </svg>
    </div>
  ),
  SSLCOMMERZ: (
    <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-[#0F172A] text-white shadow-sm">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <rect x="1" y="4" width="22" height="16" rx="2" ry="2" />
        <line x1="1" y1="10" x2="23" y2="10" />
      </svg>
    </div>
  ),
  BANK_TRANSFER: (
    <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-[#1E293B] text-white shadow-sm">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4" />
      </svg>
    </div>
  ),
};

function renderIcon(option: PaymentMethodOption) {
  if (option.icon) return option.icon;
  if (option.iconUrl) {
    return <img loading="lazy" src={option.iconUrl} alt={option.label} className="h-8.5 w-8.5 rounded-lg object-contain" />;
  }
  const key = option.value.toUpperCase();
  if (METHOD_ICONS[key]) return METHOD_ICONS[key];

  return (
    <div className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg bg-beige text-ink font-semibold text-xs border border-line">
      {option.label.charAt(0).toUpperCase()}
    </div>
  );
}

export function PaymentMethodSelector({ options, value, onChange, className }: PaymentMethodSelectorProps) {
  return (
    <div className={cn("grid grid-cols-2 gap-3 max-sm:grid-cols-1", className)}>
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
              "flex items-center gap-3 rounded-[10px] border-[1.5px] p-3 text-left font-ui text-[13.5px] transition-all",
              active ? "border-green bg-green/5 shadow-sm" : "border-line bg-white hover:border-green/50",
              disabled && "cursor-not-allowed opacity-50 hover:border-line",
            )}
          >
            {renderIcon(option)}
            <span className="flex-1 min-w-0">
              <span className="block truncate font-medium text-ink">{option.label}</span>
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
