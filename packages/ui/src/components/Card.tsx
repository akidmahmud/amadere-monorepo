"use client";

import { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  hoverLift?: boolean;
}

export function Card({ hoverLift, className, children, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-brand border border-line bg-white shadow-brand transition-transform duration-150",
        hoverLift && "hover:-translate-y-[3px]",
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
