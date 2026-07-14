import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Card } from "./Card";

export type StatCardVariant = "primary" | "warning" | "info" | "success" | "dark" | "recovery" | "danger";

export interface StatCardProps {
  label: string;
  value: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Net Profit / WPFOK-parity accent bar + icon tile — omit for the plain §5.6 card used elsewhere. */
  variant?: StatCardVariant;
  icon?: ReactNode;
  footer?: ReactNode;
}

const VARIANT_BAR: Record<StatCardVariant, string> = {
  primary: "linear-gradient(90deg, var(--brand-500), var(--brand-400))",
  warning: "linear-gradient(90deg, #f59e0b, #fbbf24)",
  info: "linear-gradient(90deg, var(--wpfok-info, #6366f1), #818cf8)",
  success: "linear-gradient(90deg, var(--success), #34d399)",
  dark: "linear-gradient(90deg, var(--wpfok-black, #0b0412), #2d1b48)",
  recovery: "linear-gradient(90deg, var(--wpfok-recovery, #06b6d4), #22d3ee)",
  danger: "linear-gradient(90deg, var(--danger), #f87171)",
};

const VARIANT_ICON: Record<StatCardVariant, string> = {
  primary: "bg-[var(--wpfok-glow,rgba(143,0,255,.15))] text-brand-500",
  warning: "bg-[var(--wpfok-warning-bg,rgba(245,158,11,.08))] text-[#f59e0b]",
  info: "bg-[var(--wpfok-info-bg,rgba(99,102,241,.08))] text-[var(--wpfok-info,#6366f1)]",
  success: "bg-[var(--wpfok-success-bg,rgba(16,185,129,.08))] text-success",
  dark: "bg-[var(--wpfok-black,#0b0412)]/10 text-[var(--wpfok-black,#0b0412)]",
  recovery: "bg-[var(--wpfok-recovery-bg,rgba(6,182,212,.08))] text-[var(--wpfok-recovery,#06b6d4)]",
  danger: "bg-danger/10 text-danger",
};

// §5.6 — overline label → display-stat number (the largest text on the
// card) → optional trailing content (e.g. a nested PaymentCard, a gauge).
// `variant`/`icon`/`footer` are additive, Net-Profit-only extensions (a top
// accent bar + colored icon tile) — omitted, the card renders exactly as
// before everywhere else in the app.
export function StatCard({ label, value, action, children, className, variant, icon, footer }: StatCardProps) {
  return (
    <Card className={cn("relative flex flex-col overflow-hidden", variant && "pt-6", className)}>
      {variant && <div className="absolute inset-x-0 top-0 h-[3px]" style={{ background: VARIANT_BAR[variant] }} />}
      {variant && icon && (
        <div className={cn("mb-3.5 grid h-11 w-11 place-items-center rounded-inner text-xl", VARIANT_ICON[variant])}>
          {icon}
        </div>
      )}
      <div className="flex items-center justify-between">
        <h3 className="font-ui text-base font-semibold text-text">{label}</h3>
        {action}
      </div>
      <div className="num mt-2 text-[28px] leading-[1.15] font-bold text-text">{value}</div>
      {children}
      {footer && <div className="mt-3 border-t border-border pt-3 text-xs text-muted">{footer}</div>}
    </Card>
  );
}
