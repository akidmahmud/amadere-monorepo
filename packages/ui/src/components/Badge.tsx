"use client";

import { ReactNode } from "react";
import { cn } from "../lib/cn";

export type BadgeVariant = "gold" | "green" | "delete";

export interface BadgeProps {
  children: ReactNode;
  variant?: BadgeVariant;
  className?: string;
}

const variantClasses: Record<BadgeVariant, string> = {
  gold: "bg-gold text-green-deep",
  green: "bg-green text-white",
  delete: "bg-delete text-white",
};

export function Badge({ children, variant = "gold", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 font-ui text-[11px] font-bold",
        variantClasses[variant],
        className,
      )}
    >
      {children}
    </span>
  );
}
