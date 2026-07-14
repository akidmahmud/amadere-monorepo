import type { InputHTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type SearchInputProps = InputHTMLAttributes<HTMLInputElement>;

const searchIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} className="h-5 w-5 flex-none">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4-4" />
  </svg>
);

// §5.4 — topbar search pill. ~260–320px wide, 40px tall.
export function SearchInput({ className, placeholder = "Search here", ...props }: SearchInputProps) {
  return (
    <label className="flex h-10 w-[280px] items-center gap-2 rounded-pill border border-border bg-surface px-4 text-secondary">
      {searchIcon}
      <input
        type="search"
        placeholder={placeholder}
        className={cn("w-full border-0 bg-transparent font-ui text-sm text-text outline-none placeholder:text-muted", className)}
        {...props}
      />
    </label>
  );
}
