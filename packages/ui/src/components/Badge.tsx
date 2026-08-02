"use client";

import { ReactNode } from "react";
import { cn } from "../lib/cn";

export type BadgeVariant = "gold" | "green" | "red" | "orange" | "delete";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  gold: "bg-gold text-green-deep",
  green: "bg-[#34be82] text-white",
  red: "bg-[#e6342e] text-white",
  orange: "bg-[#e07b1a] text-white",
  delete: "bg-delete text-white",
};

export function Badge({ children, variant = "gold", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded px-2.5 py-1 text-[11px] font-medium leading-none",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
