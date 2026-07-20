import type { CSSProperties, ReactNode } from "react";
import { cn } from "../lib/cn";

export interface PageHeaderProps {
  icon?: ReactNode;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  badge?: string;
  className?: string;
  /** Overrides the default WPFOK-scope gradient — for pages outside /net-profit that still want this hero but can't rely on `.wpfok-scope`'s CSS vars (which are deliberately scoped to that route tree only). */
  style?: CSSProperties;
}

// Net Profit / WPFOK-parity dark gradient hero — see globals.css's
// `.wpfok-scope` for why this exists as a scoped exception rather than a
// base admin-ui component. Used outside /net-profit too, but only via an
// explicit `style` override (never the CSS-var default, which only resolves
// inside `.wpfok-scope`).
export function PageHeader({ icon, title, subtitle, actions, badge, className, style }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-between overflow-hidden rounded-card px-8 py-7 text-white shadow-pop",
        className,
      )}
      style={{
        background: "linear-gradient(135deg, var(--wpfok-black) 0%, #1a0d2e 50%, var(--brand-600) 100%)",
        ...style,
      }}
    >
      <div
        className="pointer-events-none absolute -right-[15%] -top-1/2 h-[350px] w-[350px] rounded-full"
        style={{ background: "radial-gradient(circle, var(--wpfok-glow) 0%, transparent 70%)" }}
      />
      <div className="relative flex items-center gap-3">
        {icon && (
          <div
            className="grid h-10 w-10 place-items-center rounded-inner text-xl"
            style={{ background: "rgba(143, 0, 255, 0.25)" }}
          >
            {icon}
          </div>
        )}
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="font-ui text-2xl font-bold tracking-tight text-white">{title}</h1>
            {badge && (
              <span
                className="rounded-pill px-3.5 py-1 text-xs font-semibold tracking-wide text-white"
                style={{ background: "rgba(143, 0, 255, 0.3)" }}
              >
                {badge}
              </span>
            )}
          </div>
          {subtitle && <p className="mt-1 text-sm text-white/70">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="relative flex items-center gap-3">{actions}</div>}
    </div>
  );
}
