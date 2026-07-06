"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";
import { cn } from "../lib/cn";

export type ButtonVariant = "green" | "gold" | "ghost";
export type ButtonSize = "md" | "lg";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  green: "bg-green text-white hover:bg-green-dark",
  gold: "bg-gold text-green-deep font-semibold hover:bg-gold-dark",
  ghost: "bg-white border-[1.5px] border-green text-green hover:bg-cream",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "px-5 py-2.5 text-sm",
  lg: "px-5 py-3.5 text-[15px]",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    { variant = "green", size = "md", block, className, children, ...props },
    ref,
  ) => (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-[9px] font-ui font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50",
        variantClasses[variant],
        sizeClasses[size],
        block && "w-full",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  ),
);
Button.displayName = "Button";
