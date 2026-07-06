"use client";

import { ReactNode, useRef } from "react";
import { cn } from "../lib/cn";

export interface CarouselProps {
  children: ReactNode;
  className?: string;
}

const chevronLeft = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-[22px] w-[22px]">
    <path d="m15 18-6-6 6-6" />
  </svg>
);
const chevronRight = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} className="h-[22px] w-[22px]">
    <path d="m9 6 6 6-6 6" />
  </svg>
);

export function Carousel({ children, className }: CarouselProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  function scroll(direction: -1 | 1) {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({ left: direction * row.clientWidth * 0.9, behavior: "smooth" });
  }

  return (
    <div className={cn("relative px-1", className)}>
      <button
        type="button"
        aria-label="Scroll left"
        onClick={() => scroll(-1)}
        className="absolute left-[-6px] top-[30%] z-[6] grid h-[46px] w-[46px] -translate-y-1/2 place-items-center rounded-[10px] bg-gold text-white shadow-brand hover:bg-gold-dark"
      >
        {chevronLeft}
      </button>
      <div
        ref={rowRef}
        className="flex gap-4.5 overflow-x-auto scroll-smooth px-0.5 py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Scroll right"
        onClick={() => scroll(1)}
        className="absolute right-[-6px] top-[30%] z-[6] grid h-[46px] w-[46px] -translate-y-1/2 place-items-center rounded-[10px] bg-gold text-white shadow-brand hover:bg-gold-dark"
      >
        {chevronRight}
      </button>
    </div>
  );
}
