"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../lib/cn";

export type IconButtonVariant = "ghost" | "gold-round" | "danger";

export interface IconButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  "aria-label": string;
}

const variantClasses: Record<IconButtonVariant, string> = {
  ghost: "text-green [&_svg]:h-[22px] [&_svg]:w-[22px]",
  "gold-round":
    "h-[46px] w-[46px] rounded-[10px] bg-gold text-white shadow-brand hover:bg-gold-dark [&_svg]:h-[22px] [&_svg]:w-[22px]",
  danger:
    "h-[34px] w-[34px] rounded-[8px] bg-delete text-white [&_svg]:h-4 [&_svg]:w-4",
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ variant = "ghost", className, children, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "grid shrink-0 place-items-center",
        variantClasses[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
IconButton.displayName = "IconButton";
