import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface SettingsCardProps {
  icon?: ReactNode;
  title: string;
  badge?: string;
  disabled?: boolean;
  children: ReactNode;
  className?: string;
}

// Net Profit / WPFOK-parity settings section — header (icon + title,
// optional "Soon" badge) + body, dimmable when a parent toggle is off. See
// globals.css's `.wpfok-scope`.
export function SettingsCard({ icon, title, badge, disabled, children, className }: SettingsCardProps) {
  return (
    <div className={cn("overflow-hidden rounded-card border border-border bg-surface shadow-card", className)}>
      <div className="flex items-center justify-between border-b border-border bg-surface-2 px-6 py-4">
        <div className="flex items-center gap-2.5">
          {icon && <span className="text-brand-500 [&>svg]:h-5 [&>svg]:w-5 [&_.material-symbols-outlined]:!text-[20px]">{icon}</span>}
          <h2 className="font-ui text-[15px] font-bold text-text">{title}</h2>
        </div>
        {badge && (
          <span className="rounded-pill bg-[var(--wpfok-warning-bg,rgba(245,158,11,.08))] px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-[#f59e0b]">
            {badge}
          </span>
        )}
      </div>
      <div className={cn("p-6", disabled && "pointer-events-none opacity-60")}>{children}</div>
    </div>
  );
}
