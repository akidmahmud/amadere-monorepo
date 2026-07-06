"use client";

import { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export function Container({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("mx-auto max-w-[1180px] px-5", className)} {...props}>
      {children}
    </div>
  );
}
