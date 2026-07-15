import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface IconTileProps {
  children: ReactNode;
  className?: string;
}

// §2.7 / §3 — 40px rounded surface-2 square holding a centered 20px icon.
// Used in list rows (§5.10) and category breakdown headers (§5.12).
export function IconTile({ children, className }: IconTileProps) {
  return (
    <div
      className={cn(
        "grid h-10 w-10 flex-none place-items-center rounded-inner bg-surface-2 text-secondary [&>svg]:h-5 [&>svg]:w-5 [&_.material-symbols-outlined]:!text-[20px]",
        className,
      )}
    >
      {children}
    </div>
  );
}
