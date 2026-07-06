"use client";

import { InputHTMLAttributes, ReactNode, forwardRef } from "react";
import { cn } from "../lib/cn";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  leadingIcon?: ReactNode;
  trailingIcon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ leadingIcon, trailingIcon, className, ...props }, ref) => {
    if (!leadingIcon && !trailingIcon) {
      return (
        <input
          ref={ref}
          className={cn(
            "w-full rounded-[10px] border border-line bg-white px-3.5 py-2.5 font-body text-sm text-ink outline-none placeholder:text-muted focus:border-green",
            className,
          )}
          {...props}
        />
      );
    }

    return (
      <div className="relative">
        {leadingIcon && (
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gold-dark [&_svg]:h-[18px] [&_svg]:w-[18px]">
            {leadingIcon}
          </span>
        )}
        <input
          ref={ref}
          className={cn(
            "w-full rounded-[10px] border border-line bg-white py-2.5 font-body text-sm text-ink outline-none placeholder:text-muted focus:border-green",
            leadingIcon ? "pl-10 pr-3.5" : "pl-3.5",
            trailingIcon ? "pr-10" : "pr-3.5",
            className,
          )}
          {...props}
        />
        {trailingIcon && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 cursor-pointer text-gold-dark [&_svg]:h-[18px] [&_svg]:w-[18px]">
            {trailingIcon}
          </span>
        )}
      </div>
    );
  },
);
Input.displayName = "Input";
