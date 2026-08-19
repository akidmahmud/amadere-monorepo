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
// base admin-ui component.
//
// Every var() below carries a literal fallback matching what `.wpfok-scope`
// defines. That is load-bearing, not belt-and-braces: outside that scope
// these custom properties don't resolve at all, which made the whole
// `linear-gradient(...)` declaration invalid and dropped the background
// entirely — leaving this hero's `text-white` title and `text-white/70`
// subtitle on the page's own white card. Reported from the customer detail
// page, where the name was white-on-white and only the translucent purple
// icon/badge chips were visible. `/customers/[id]` and `/customers/tiers`
// were the two screens affected; everything else using this sits under
// `.wpfok-scope`, where these same values come from the scope and nothing
// changes. An explicit `style` override still wins over all of it.
export function PageHeader({ icon, title, subtitle, actions, badge, className, style }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-between overflow-hidden rounded-card px-8 py-7 text-white shadow-pop",
        className,
      )}
      style={{
        background:
          "linear-gradient(135deg, var(--wpfok-black, #0b0412) 0%, #1a0d2e 50%, var(--brand-600, #7200cc) 100%)",
        ...style,
      }}
    >
      <div
        className="pointer-events-none absolute -right-[15%] -top-1/2 h-[350px] w-[350px] rounded-full"
        style={{ background: "radial-gradient(circle, var(--wpfok-glow, rgba(143, 0, 255, 0.15)) 0%, transparent 70%)" }}
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
