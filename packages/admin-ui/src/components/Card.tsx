import type { HTMLAttributes } from "react";
import { cn } from "../lib/cn";

export type CardProps = HTMLAttributes<HTMLDivElement>;

// §1.2 / §5.6 — the unit of layout. Rounded surface, barely-there shadow,
// generous padding. Dark theme swaps the shadow for a border (§2.8/§6) purely
// via token values (`--shadow-card` becomes `none`, `--border` brightens) in
// globals.css — this component never branches on theme itself, and never
// uses Tailwind's `dark:` variant (it's tied to prefers-color-scheme, not our
// `[data-theme]` attribute toggle).
export function Card({ className, children, ...props }: CardProps) {
  return (
    <div className={cn("rounded-card border border-border bg-surface p-[22px] shadow-card", className)} {...props}>
      {children}
    </div>
  );
}
